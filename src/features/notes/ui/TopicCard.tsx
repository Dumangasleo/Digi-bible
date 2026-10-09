import { format, parseISO } from 'date-fns';
import { Pressable, Text } from 'react-native';

import { type TopicSummary } from '../types';

interface TopicCardProps {
  topic: TopicSummary;
  /** Pre-formatted first verse, e.g. "Hebrews 11:1"; null if none is left. */
  verseLabel: string | null;
  onPress: () => void;
}

/**
 * One topic: title, first verse, description, created date — top to bottom.
 *
 * @param topic - The topic summary row.
 * @param verseLabel - The formatted first verse. Passed in, not computed here:
 *                     turning a BookId into "Hebrews" needs bible-reader's book
 *                     names, and a notes component must not import bible-reader.
 * @param onPress - Opens the topic.
 * @returns The card.
 */
export function TopicCard({ topic, verseLabel, onPress }: TopicCardProps) {
  const more = topic.VerseCount - 1;

  return (
    <Pressable
      onPress={onPress}
      className="mb-3 rounded-2xl bg-neutral-100 p-4 active:opacity-70 dark:bg-neutral-900">
      <Text className="text-lg font-bold text-neutral-900 dark:text-white">{topic.Title}</Text>

      {verseLabel ? (
        <Text className="mt-0.5 text-xs font-semibold text-brand-500">
          {verseLabel}
          {more > 0 ? `  ·  +${more} ${more === 1 ? 'verse' : 'verses'}` : ''}
        </Text>
      ) : null}

      {topic.Description ? (
        <Text
          numberOfLines={3}
          className="mt-2 text-sm leading-5 text-neutral-600 dark:text-neutral-300">
          {topic.Description}
        </Text>
      ) : null}

      <Text className="mt-3 text-xs text-neutral-400">
        {format(parseISO(topic.CreatedAt), 'd MMM yyyy')}
      </Text>
    </Pressable>
  );
}
