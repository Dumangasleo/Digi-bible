import { type SQLiteDatabase } from 'expo-sqlite';

import { readingHistoryRepository } from '../data/reading-history.repository';
import { type DayActivity, type NewReadingEntry, type ReadingEntry } from '../types';

/**
 * Reading-history business logic. The reader composes this at the route level
 * (record what was opened) — keeping bible-reader and verse-history decoupled.
 */
export const historyService = {
  record: (db: SQLiteDatabase, entry: NewReadingEntry): Promise<number> =>
    readingHistoryRepository.record(db, entry),

  getDay: (db: SQLiteDatabase, day: string): Promise<ReadingEntry[]> =>
    readingHistoryRepository.listByDay(db, day),

  getMonth: (db: SQLiteDatabase, month: string): Promise<DayActivity[]> =>
    readingHistoryRepository.activityForMonth(db, month),
};
