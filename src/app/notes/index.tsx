import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { useActiveTranslation, useBooks } from '@/features/bible-reader';
import { TopicCard, useTopics, type TopicList, type TopicSummary } from '@/features/notes';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { AppButton } from '@/shared/ui/AppButton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Screen } from '@/shared/ui/Screen';
import { formatReference } from '@/shared/utils/reference';

const EMPTY_LIST: TopicList = { topics: [], uncategorizedCount: 0 };

/**
 * Notes tab root: every study topic, newest first, plus the "Walay Topic" group.
 *
 * @returns The topics list screen.
 * @remarks Reloads on focus — this screen stays mounted under the stack, so a
 *          topic created on /notes/new or a verse added elsewhere would otherwise
 *          not appear when you come back.
 */
export default function TopicsScreen() {
  const router = useRouter();
  const topics = useTopics();
  const { translationId } = useActiveTranslation();
  const { byId } = useBooks(translationId);

  const loader = useCallback(() => topics.list(), [topics]);
  const { data, loading, reload } = useAsyncData<TopicList>(loader, EMPTY_LIST);
  useFocusEffect(reload);

  /**
   * Formats a topic's first verse for its card.
   *
   * @param t - The topic summary.
   * @returns e.g. "Hebrews 11:1", or null if the topic has no verse left.
   */
  function verseLabel(t: TopicSummary): string | null {
    if (t.FirstBookId == null || t.FirstChapter == null || t.FirstVerse == null) return null;
    const bookName = byId.get(t.FirstBookId)?.Name ?? `Book ${t.FirstBookId}`;
    return formatReference(bookName, t.FirstChapter, t.FirstVerse);
  }

  const isEmpty = !loading && data.topics.length === 0 && data.uncategorizedCount === 0;

  return (
    <Screen>
      <View className="flex-row items-center justify-between px-5 pb-4 pt-2">
        <View>
          <Text className="text-3xl font-bold text-neutral-900 dark:text-white">Notes</Text>
          <Text className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {data.topics.length} {data.topics.length === 1 ? 'topic' : 'topics'}
          </Text>
        </View>
        <AppButton label="+ New" onPress={() => router.push('/notes/new')} />
      </View>

      <FlatList
        data={data.topics}
        keyExtractor={(t) => String(t.Id)}
        contentContainerClassName="px-5 pb-10"
        renderItem={({ item }) => (
          <TopicCard
            topic={item}
            verseLabel={verseLabel(item)}
            onPress={() =>
              router.push({ pathname: '/notes/[id]', params: { id: String(item.Id) } })
            }
          />
        )}
        ListEmptyComponent={
          isEmpty ? (
            <EmptyState
              emoji="📚"
              title="No topics yet"
              subtitle="Tap + New to start a study topic — give it a title, pick a verse, and add more related verses as you go."
            />
          ) : null
        }
        ListFooterComponent={
          data.uncategorizedCount > 0 ? (
            <Pressable
              onPress={() => router.push({ pathname: '/notes/[id]', params: { id: 'none' } })}
              className="mt-2 flex-row items-center justify-between rounded-2xl border border-dashed border-neutral-300 p-4 active:opacity-70 dark:border-neutral-700">
              <Text className="text-base font-semibold text-neutral-600 dark:text-neutral-300">
                Walay Topic
              </Text>
              <Text className="text-sm text-neutral-400">
                {data.uncategorizedCount} {data.uncategorizedCount === 1 ? 'note' : 'notes'} ›
              </Text>
            </Pressable>
          ) : null
        }
      />
    </Screen>
  );
}
