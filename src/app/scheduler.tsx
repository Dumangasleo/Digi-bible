import { format, isSameDay, parseISO } from 'date-fns';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { EventComposer, useEvents, type ChurchEvent } from '@/features/scheduler';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { AppButton } from '@/shared/ui/AppButton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Screen } from '@/shared/ui/Screen';

/** Events plus the instant they were loaded, so "past" is decided off-render. */
interface EventSnapshot {
  rows: ChurchEvent[];
  now: number;
}

const EMPTY_SNAPSHOT: EventSnapshot = { rows: [], now: 0 };

/**
 * Renders how far ahead a reminder fires, in words.
 *
 * @param minutes - Minutes before the start, or `null` for no reminder.
 * @returns A short label such as `'30 min before'`, or `null` when there is no
 *          reminder — callers render nothing in that case.
 */
function reminderLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes >= 1440) return `${minutes / 1440} day before`;
  if (minutes >= 60) return `${minutes / 60} hour before`;
  return `${minutes} min before`;
}

/**
 * Church tab: upcoming services and events, with local reminders.
 *
 * @returns The Church tab.
 * @remarks Lists **all** events rather than only future ones, so a user can see
 *          and clean up what has passed. "Upcoming" is conveyed by graying past
 *          rows instead of hiding them — a hidden event that still owns a
 *          scheduled notification is an event the user cannot cancel.
 */
export default function SchedulerScreen() {
  const events = useEvents();
  const [composing, setComposing] = useState(false);

  /**
   * Loads every event and stamps the moment the list was read.
   *
   * @returns The rows plus the epoch millisecond they were loaded at.
   * @remarks `Date.now()` is impure and may not be called during render — the
   *          React Compiler rejects it outright. Stamping it in the loader also
   *          happens to be more correct: "is this event past?" is then answered
   *          against the load, and refreshes when the list refreshes, instead of
   *          drifting silently while the screen sits open.
   */
  const loader = useCallback(
    async () => ({ rows: await events.listAll(), now: Date.now() }),
    [events],
  );
  const { data, loading, reload } = useAsyncData<EventSnapshot>(loader, EMPTY_SNAPSHOT);
  const { rows, now } = data;

  /**
   * Asks before deleting, then deletes and refreshes.
   *
   * @param event - The event to remove.
   * @remarks Deleting also cancels the OS notification — that is the service's
   *          job, not this screen's, which is why the UI calls `remove` rather
   *          than touching `expo-notifications` itself.
   */
  function confirmDelete(event: ChurchEvent) {
    Alert.alert('Delete event?', `"${event.Title}" and its reminder will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void events.remove(event.Id).then(reload);
        },
      },
    ]);
  }

  return (
    <Screen>
      <View className="flex-row items-center justify-between px-5 pb-4 pt-2">
        <View>
          <Text className="text-3xl font-bold text-neutral-900 dark:text-white">Church</Text>
          <Text className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            Services, prayer meetings, reminders
          </Text>
        </View>
        <AppButton label="+ New" onPress={() => setComposing(true)} />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(event) => String(event.Id)}
        contentContainerClassName="px-5 pb-10"
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              emoji="⛪"
              title="No events scheduled"
              subtitle="Add your Sunday service or prayer meeting and SmartBible will remind you before it starts."
            />
          )
        }
        renderItem={({ item }) => {
          const startsAt = parseISO(item.StartsAt);
          const isPast = startsAt.getTime() < now;
          const reminder = reminderLabel(item.ReminderMinutes);

          return (
            <View
              className={`mb-3 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-900 ${
                isPast ? 'opacity-50' : ''
              }`}>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-500">
                    {format(startsAt, 'EEE, d MMM')}
                    {isSameDay(startsAt, new Date()) ? ' · Today' : ''}
                  </Text>
                  <Text className="text-base font-semibold text-neutral-900 dark:text-white">
                    {item.Title}
                  </Text>
                  <Text className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                    {format(startsAt, 'HH:mm')}
                    {item.Location ? ` · ${item.Location}` : ''}
                  </Text>
                  {item.Description ? (
                    <Text
                      numberOfLines={2}
                      className="mt-2 text-sm leading-5 text-neutral-600 dark:text-neutral-300">
                      {item.Description}
                    </Text>
                  ) : null}
                </View>

                <Pressable onPress={() => confirmDelete(item)} hitSlop={8}>
                  <Text className="text-base opacity-40">🗑</Text>
                </Pressable>
              </View>

              {reminder ? (
                <View className="mt-3 self-start rounded-full bg-white px-3 py-1 dark:bg-neutral-800">
                  <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-300">
                    🔔 {reminder}
                    {item.NotificationId ? '' : ' · not scheduled'}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }}
      />

      {composing ? (
        <EventComposer onClose={() => setComposing(false)} onSaved={reload} />
      ) : null}
    </Screen>
  );
}
