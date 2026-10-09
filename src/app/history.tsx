import { format, parseISO } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useActiveTranslation, useBooks, useReaderStore } from '@/features/bible-reader';
import { useNotes, type Note } from '@/features/notes';
import {
  MonthCalendar,
  useReadingHistory,
  type DayActivity,
  type ReadingEntry,
} from '@/features/verse-history';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Screen } from '@/shared/ui/Screen';
import { toLocalDay, toLocalMonth } from '@/shared/utils/date';
import { formatReference } from '@/shared/utils/reference';

const NO_ACTIVITY: DayActivity[] = [];
const NO_ENTRIES: ReadingEntry[] = [];
const NO_NOTES: Note[] = [];

/**
 * Calendar tab: which days you read, what you read, and what you wrote.
 *
 * @returns The History tab.
 * @remarks Three independent reads — month activity, the selected day's
 *          readings, the selected day's notes — each with its own `useAsyncData`
 *          rather than one combined query. They have different cache lifetimes:
 *          paging the month must not re-query the day, and tapping a day must
 *          not re-query the month. Merging them would make every interaction
 *          reload all three.
 */
export default function HistoryScreen() {
  const router = useRouter();
  const history = useReadingHistory();
  const notes = useNotes();
  const { translationId } = useActiveTranslation();
  const { byId } = useBooks(translationId);
  const setPosition = useReaderStore((s) => s.setPosition);

  // Lazy initializers: both read the system clock, which is impure and must not
  // run during render. Once at mount is exactly the intent anyway.
  const [month, setMonth] = useState(() => toLocalMonth());
  const [selectedDay, setSelectedDay] = useState(() => toLocalDay());

  const activityLoader = useCallback(() => history.forMonth(month), [history, month]);
  const { data: activityRows, reload: reloadActivity } = 
      useAsyncData<DayActivity[]>(activityLoader, NO_ACTIVITY);

  const dayLoader = useCallback(
    () => history.forDay(selectedDay),
    [history, selectedDay],
  );
  const { data: dayEntries, reload: reloadDay } = 
    useAsyncData<ReadingEntry[]>(dayLoader, NO_ENTRIES);

  const dayNotesLoader = useCallback(
    () => notes.listForDay(selectedDay),
    [notes, selectedDay],
  );
  const { data: dayNotes, reload: reloadDayNotes } 
    = useAsyncData<Note[]>(dayNotesLoader, NO_NOTES);

  // Array → Map once per month load, so the calendar's 31 lookups are O(1).
  const activity = useMemo(
    () => new Map(activityRows.map((row) => [row.ReadOn, row.Count])),
    [activityRows],
  );

  /**
   * Opens a past reading in the reader.
   *
   * @param entry - The history row that was tapped.
   * @remarks Sets the shared reader position *before* navigating, so the Read
   *          tab renders the right chapter on its first frame instead of
   *          flashing the previous one.
   */
  function openInReader(entry: ReadingEntry) {
    setPosition(entry.BookId, entry.Chapter);
    router.push('/read');
  }

  const monthTotal = activityRows.reduce((sum, row) => sum + row.Count, 0);

  useFocusEffect(
    useCallback(() => {
      reloadActivity();
      reloadDay();
      reloadDayNotes();
    }, [reloadActivity, reloadDay, reloadDayNotes]), 
  )

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-10" showsVerticalScrollIndicator={false}>
        <View className="pb-4 pt-2">
          <Text className="text-3xl font-bold text-neutral-900 dark:text-white">History</Text>
          <Text className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {monthTotal} {monthTotal === 1 ? 'reading' : 'readings'} this month
          </Text>
        </View>

        <MonthCalendar
          month={month}
          activity={activity}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onChangeMonth={setMonth}
        />

        <Text className="mb-3 mt-7 text-lg font-bold text-neutral-900 dark:text-white">
          {format(parseISO(selectedDay), 'EEEE, d MMMM')}
        </Text>

        {dayEntries.length === 0 && dayNotes.length === 0 ? (
          <EmptyState
            emoji="🕊"
            title="Nothing on this day"
            subtitle="Open a chapter in the Read tab and it will show up here."
          />
        ) : null}

        {dayEntries.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
              Read
            </Text>
            {dayEntries.map((entry) => (
              <Pressable
                key={entry.Id}
                onPress={() => openInReader(entry)}
                className="mb-2 flex-row items-center justify-between rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
                <Text className="text-base text-neutral-900 dark:text-white">
                  {byId.get(entry.BookId)?.Name ?? `Book ${entry.BookId}`} {entry.Chapter}
                </Text>
                <Text className="text-xs text-neutral-400">
                  {format(parseISO(entry.ReadAt), 'HH:mm')}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {dayNotes.length > 0 ? (
          <View>
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
              Written
            </Text>
            {dayNotes.map((note) => (
              <View
                key={note.Id}
                className="mb-2 rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
                <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-500">
                  {formatReference(
                    byId.get(note.BookId)?.Name ?? `Book ${note.BookId}`,
                    note.Chapter,
                    note.VerseStart,
                    note.VerseEnd,
                  )}
                </Text>
                <Text
                  numberOfLines={2}
                  className="text-sm leading-5 text-neutral-600 dark:text-neutral-300">
                  {note.Title ?? note.Body}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
