import { type SQLiteDatabase } from 'expo-sqlite';

import { type Verse } from '@/features/bible-reader';
import { toLocalDay } from '@/shared/utils/date';

/**
 * Deterministic, order-independent hash of a 'YYYY-MM-DD' string.
 *
 * @param day - Local day key.
 * @returns A non-negative 32-bit integer.
 * @remarks Deliberately not `Math.random()` and deliberately not stored: the
 *          pick must be identical on every launch of the same day and identical
 *          across devices, without a "daily picks" table to maintain or sync.
 */
function hashDay(day: string): number {
  let h = 0;
  for (let i = 0; i < day.length; i++) {
    h = (h * 31 + day.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export const dailyVerseService = {
  /**
   * "Verse of the day": the same verse for everyone on a given calendar day,
   * rotating deterministically so it's stable without storing daily picks.
   *
   * @param db - Open connection.
   * @param translationId - Which translation to draw from.
   * @param day - Local day 'YYYY-MM-DD'; defaults to today.
   * @returns The verse, or `null` when no text has been imported for this
   *          translation yet. `null` is a normal pre-import state, not an error.
   * @remarks `LIMIT 1 OFFSET n` over an ordered scan is O(n) inside SQLite — for
   *          a 31,102-row table that is a few milliseconds once, on mount. The
   *          alternative (a random `Id` lookup) is O(1) but breaks the moment a
   *          re-import renumbers AUTOINCREMENT ids, silently changing which
   *          verse "today" maps to. Stability beats the microseconds here.
   */
  async getVerseOfDay(
    db: SQLiteDatabase,
    translationId: number,
    day: string = toLocalDay(),
  ): Promise<Verse | null> {
    const total = await db.getFirstAsync<{ N: number }>(
      'SELECT COUNT(*) AS N FROM Verses WHERE TranslationId = ?',
      [translationId],
    );
    const count = total?.N ?? 0;
    if (count === 0) return null;

    const offset = hashDay(day) % count;
    return db.getFirstAsync<Verse>(
      `SELECT * FROM Verses
        WHERE TranslationId = ?
        ORDER BY BookId, Chapter, Verse
        LIMIT 1 OFFSET ?`,
      [translationId, offset],
    );
  },
};
