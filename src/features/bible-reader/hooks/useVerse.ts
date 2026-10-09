import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { useAsyncData } from '@/shared/hooks/useAsyncData';

import { bibleService } from '../services/bible.service';
import { type Verse } from '../types';

/**
 * Loads a single verse's text — for previewing a picked verse before saving.
 *
 * @param translationId - Translation to read from, or `null` while it resolves.
 * @param ref - The verse to load, or `null` when nothing is picked yet.
 * @returns `{ verse, loading }`. `verse` is `null` when nothing is picked or that
 *          translation's text is not imported — both normal states, not errors.
 * @remarks `ref` is typed structurally (`{ bookId, chapter, verse }`) instead of
 *          importing `VerseRef` from the notes feature — bible-reader must not
 *          depend on notes, and TypeScript accepts a `VerseRef` here anyway
 *          because the shapes match.
 *
 *          The loader depends on the three numbers, not on the `ref` object. A
 *          caller that rebuilds `{ bookId, chapter, verse }` every render would
 *          otherwise hand us a new object identity each time and re-query forever.
 */
export function useVerse(
  translationId: number | null,
  ref: { bookId: number; chapter: number; verse: number } | null,
) {
  const db = useSQLiteContext();
  const bookId = ref?.bookId;
  const chapter = ref?.chapter;
  const verseNumber = ref?.verse;

  const loader = useCallback(
    () =>
      translationId == null || bookId == null || chapter == null || verseNumber == null
        ? Promise.resolve(null)
        : bibleService.getVerse(db, translationId, bookId, chapter, verseNumber),
    [db, translationId, bookId, chapter, verseNumber],
  );
  const { data: verse, loading } = useAsyncData<Verse | null>(loader, null);

  return { verse, loading };
}
