import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { historyService } from '../services/history.service';
import { type NewReadingEntry } from '../types';

export function useReadingHistory() {
  const db = useSQLiteContext();
  return useMemo(
    () => ({
      record: (entry: NewReadingEntry) => historyService.record(db, entry),
      forDay: (day: string) => historyService.getDay(db, day),
      forMonth: (month: string) => historyService.getMonth(db, month),
    }),
    [db],
  );
}
