import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { useAsyncData } from '@/shared/hooks/useAsyncData';

import { bibleService } from '../services/bible.service';
import { type Verse } from '../types';

const NO_VERSES: Verse[] = [];

/**
 * Loads the verses for a chapter, re-fetching whenever the reference or
 * translation changes.
 *
 * @param translationId - `Translations.Id`, or `null` while resolving.
 * @param bookId - Canonical book id, 1..66.
 * @param chapter - 1-based chapter number.
 * @returns `{ verses, loading }`. An empty `verses` with `loading === false`
 *          means the chapter has no text imported — a normal state the reader
 *          renders as an empty state, not an error.
 * @remarks Cancellation lives in `useAsyncData`: tapping "next chapter" three
 *          times fast fires three queries, and without it the slowest could
 *          resolve last and leave the wrong chapter on screen.
 */
export function useChapter(
  translationId: number | null,
  bookId: number,
  chapter: number,
) {
  const db = useSQLiteContext();

  const loader = useCallback(
    () =>
      translationId == null
        ? Promise.resolve(NO_VERSES)
        : bibleService.getChapter(db, translationId, bookId, chapter),
    [db, translationId, bookId, chapter],
  );
  const { data: verses, loading } = useAsyncData<Verse[]>(loader, NO_VERSES);

  return { verses, loading };
}
