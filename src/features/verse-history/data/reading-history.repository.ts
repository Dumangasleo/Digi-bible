import { type SQLiteDatabase } from 'expo-sqlite';

import { toLocalDay } from '@/shared/utils/date';

import { type DayActivity, type NewReadingEntry, type ReadingEntry } from '../types';

/** Pure data access for the date-based reading history. */
export const readingHistoryRepository = {
  /**
   * Appends a reading entry.
   *
   * @param db - Open connection.
   * @param entry - What was read; `readOn` defaults to the device's local day.
   * @returns The new `ReadingHistory.Id`.
   * @remarks `ReadOn` is a denormalized *local* day, stored alongside the UTC
   *          `ReadAt` instant. It exists so the calendar can group by a day the
   *          user recognizes using a plain indexed equality test, instead of a
   *          `date(ReadAt,'localtime')` expression that no index can serve.
   *          The cost is that history does not follow the user across time
   *          zones — which is the correct behaviour for "what did I read that
   *          day", since the day it *felt* like is the day it was.
   */
  async record(db: SQLiteDatabase, entry: NewReadingEntry): Promise<number> {
    const readOn = entry.readOn ?? toLocalDay();
    const result = await db.runAsync(
      `INSERT INTO ReadingHistory (BookId, Chapter, Verse, TranslationId, ReadOn)
       VALUES (?, ?, ?, ?, ?)`,
      [entry.bookId, entry.chapter, entry.verse ?? null, entry.translationId ?? null, readOn],
    );
    return result.lastInsertRowId;
  },

  /**
   * @param db - Open connection.
   * @param day - Local day 'YYYY-MM-DD'.
   * @returns That day's readings, newest first. Empty for a day with no reading.
   */
  listByDay(db: SQLiteDatabase, day: string): Promise<ReadingEntry[]> {
    return db.getAllAsync<ReadingEntry>(
      'SELECT * FROM ReadingHistory WHERE ReadOn = ? ORDER BY ReadAt DESC',
      [day],
    );
  },

  /**
   * Per-day activity counts within a month.
   *
   * @param db - Open connection.
   * @param month - Local month 'YYYY-MM'.
   * @returns One row per day that has at least one reading, ascending. Days with
   *          no activity are simply absent — the calendar treats missing as zero.
   * @remarks `ReadOn LIKE 'YYYY-MM-%'` is a prefix pattern, which SQLite can turn
   *          into an index range scan on `IdxHistoryDay` rather than a table scan.
   *          `Count` is quoted because COUNT is also a function name.
   */
  activityForMonth(db: SQLiteDatabase, month: string): Promise<DayActivity[]> {
    return db.getAllAsync<DayActivity>(
      `SELECT ReadOn, COUNT(*) AS "Count"
         FROM ReadingHistory
        WHERE ReadOn LIKE ?
        GROUP BY ReadOn
        ORDER BY ReadOn`,
      [`${month}-%`],
    );
  },
};
