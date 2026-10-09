import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { type Verse } from '@/features/bible-reader';
import { useAsyncData } from '@/shared/hooks/useAsyncData';

import { dailyVerseService } from '../services/daily-verse.service';

/**
 * Resolves the verse of the day for a translation.
 *
 * @param translationId - `Translations.Id`, or `null` while it is still resolving.
 * @returns `{ verse, loading }`. A `null` `verse` with `loading === false` means
 *          no verse text has been imported yet — the caller renders a prompt,
 *          not an error.
 */
export function useDailyVerse(translationId: number | null) {
  const db = useSQLiteContext();

  const loader = useCallback(
    () =>
      translationId == null
        ? Promise.resolve(null)
        : dailyVerseService.getVerseOfDay(db, translationId),
    [db, translationId],
  );
  const { data: verse, loading } = useAsyncData<Verse | null>(loader, null);

  return { verse, loading };
}
