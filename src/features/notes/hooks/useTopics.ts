import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { topicsService } from '../services/topics.service';
import { type NewTopic, type NewTopicVerse, type TopicPatch } from '../types';

/**
 * Binds the topics service to the active DB connection:
 *   const topics = useTopics(); await topics.create({...});
 *
 * @returns A stable object of topic operations.
 * @remarks Memoized on `db` (stable for the app's lifetime) so that loaders built
 *          on these functions keep their identity and do not re-query every render.
 */
export function useTopics() {
  const db = useSQLiteContext();
  return useMemo(
    () => ({
      list: () => topicsService.listTopics(db),
      detail: (topicId: number | null, translationId: number) =>
        topicsService.getTopicDetail(db, topicId, translationId),
      create: (input: NewTopic) => topicsService.createTopic(db, input),
      update: (topicId: number, patch: TopicPatch) =>
        topicsService.updateTopic(db, topicId, patch),
      addVerse: (input: NewTopicVerse) => topicsService.addVerse(db, input),
      removeVerse: (noteId: number) => topicsService.removeVerse(db, noteId),
      setHighlights: (noteId: number, translationId: number, words: readonly number[]) =>
        topicsService.setHighlights(db, noteId, translationId, words),
      addText: (topicId: number, body: string) => topicsService.addText(db, topicId, body),
      editText: (textId: number, body: string) => topicsService.editText(db, textId, body),
      removeText: (textId: number) => topicsService.removeText(db, textId),
      remove: (topicId: number) => topicsService.deleteTopic(db, topicId),
    }),
    [db],
  );
}
