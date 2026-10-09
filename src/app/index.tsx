import { format, parseISO } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useActiveTranslation, useBooks, useReaderStore } from '@/features/bible-reader';
import { useDailyVerse } from '@/features/daily-verse';
import { useEvents, type ChurchEvent } from '@/features/scheduler';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { Screen } from '@/shared/ui/Screen';
import { nowIso } from '@/shared/utils/date';
import { formatReference } from '@/shared/utils/reference';

const NO_EVENTS: ChurchEvent[] = [];

interface HomeCardProps {
  emoji: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

/**
 * Tappable shortcut row on the home screen.
 *
 * @param emoji - Leading glyph.
 * @param title - Card headline.
 * @param subtitle - Supporting line.
 * @param onPress - Navigation handler.
 * @returns The card.
 */
function HomeCard({ emoji, title, subtitle, onPress }: HomeCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-2xl bg-neutral-100 p-4 active:opacity-70 dark:bg-neutral-900">
      <Text className="text-2xl">{emoji}</Text>
      <View className="ml-4 flex-1">
        <Text className="text-base font-semibold text-neutral-900 dark:text-white">
          {title}
        </Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</Text>
      </View>
      <Text className="text-xl text-neutral-400">›</Text>
    </Pressable>
  );
}

/**
 * Home tab: verse of the day, the next church event, and shortcuts.
 *
 * @returns The Home tab.
 * @remarks The verse-of-the-day card has three distinct states — loading, a real
 *          verse, and "no text imported". The third is not an error and must not
 *          read like one: a fresh install genuinely has an empty `Verses` table
 *          until `importTranslation` runs, and the card is the most visible place
 *          to say so.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { translationId } = useActiveTranslation();
  const { byId } = useBooks(translationId);
  const { verse, loading } = useDailyVerse(translationId);
  const setPosition = useReaderStore((s) => s.setPosition);

  const events = useEvents();
  const upcomingLoader = useCallback(() => events.listUpcoming(nowIso()), [events]);
  const { data: upcoming, reload: reloadUpComing } = useAsyncData<ChurchEvent[]>(upcomingLoader, NO_EVENTS);
  const nextEvent = upcoming[0] ?? null;

  /** Opens the verse of the day in the reader at its own chapter. */
  function openDailyVerse() {
    if (!verse) return;
    setPosition(verse.BookId, verse.Chapter);
    router.push('/read');
  }

  useFocusEffect(reloadUpComing);

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-10" showsVerticalScrollIndicator={false}>
        <View className="pb-6 pt-4">
          <Text className="text-sm font-semibold text-brand-500">SmartBible</Text>
          <Text className="text-3xl font-bold text-neutral-900 dark:text-white">
            Good day 🙏
          </Text>
          <Text className="mt-1 text-base text-neutral-500 dark:text-neutral-400">
            English · Tagalog · Bisaya
          </Text>
        </View>

        <Pressable
          onPress={openDailyVerse}
          disabled={!verse}
          className="rounded-3xl bg-brand-500 p-6 active:opacity-90">
          <Text className="text-xs font-semibold uppercase tracking-wider text-brand-100">
            Verse of the day
          </Text>

          {loading ? (
            <Text className="mt-3 text-base text-brand-100">Loading…</Text>
          ) : verse ? (
            <>
              <Text className="mt-3 text-xl font-semibold leading-8 text-white">
                {verse.Text}
              </Text>
              <Text className="mt-3 text-sm font-medium text-brand-100">
                {formatReference(
                  byId.get(verse.BookId)?.Name ?? `Book ${verse.BookId}`,
                  verse.Chapter,
                  verse.Verse,
                )}
              </Text>
            </>
          ) : (
            <>
              <Text className="mt-3 text-lg font-semibold leading-7 text-white">
                No verse text loaded yet
              </Text>
              <Text className="mt-3 text-sm leading-5 text-brand-100">
                The books, chapters, notes, calendar and reminders all work. Import a
                translation with `importTranslation()` and the daily verse, reader and
                search light up.
              </Text>
            </>
          )}
        </Pressable>

        {nextEvent ? (
          <>
            <Text className="mb-3 mt-8 text-lg font-bold text-neutral-900 dark:text-white">
              Next up
            </Text>
            <Pressable
              onPress={() => router.push('/scheduler')}
              className="rounded-2xl border border-brand-200 bg-brand-50 p-4 active:opacity-70 dark:border-brand-900 dark:bg-brand-900/30">
              <Text className="text-xs font-bold uppercase tracking-wider text-brand-500">
                {format(parseISO(nextEvent.StartsAt), 'EEE, d MMM · HH:mm')}
              </Text>
              <Text className="mt-1 text-base font-semibold text-neutral-900 dark:text-white">
                {nextEvent.Title}
              </Text>
              {nextEvent.Location ? (
                <Text className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                  {nextEvent.Location}
                </Text>
              ) : null}
            </Pressable>
          </>
        ) : null}

        <Text className="mb-3 mt-8 text-lg font-bold text-neutral-900 dark:text-white">
          Continue
        </Text>
        <View className="gap-3">
          <HomeCard
            emoji="📖"
            title="Read the Word"
            subtitle="Open the tri-lingual reader"
            onPress={() => router.push('/read')}
          />
          <HomeCard
            emoji="📝"
            title="My Notes"
            subtitle="Voice-to-text study notes"
            onPress={() => router.push('/notes')}
          />
          <HomeCard
            emoji="📅"
            title="Reading History"
            subtitle="See the days you spent in the Word"
            onPress={() => router.push('/history')}
          />
          <HomeCard
            emoji="⛪"
            title="Church Schedule"
            subtitle="Events & reminders"
            onPress={() => router.push('/scheduler')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
