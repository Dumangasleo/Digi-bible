import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { schedulerService } from '../services/scheduler.service';
import { type NewEvent } from '../types';

export function useEvents() {
  const db = useSQLiteContext();
  return useMemo(
    () => ({
      create: (input: NewEvent) => schedulerService.createEvent(db, input),
      listUpcoming: (fromIso: string) => schedulerService.listUpcoming(db, fromIso),
      listAll: () => schedulerService.listAll(db),
      remove: (id: number) => schedulerService.deleteEvent(db, id),
    }),
    [db],
  );
}
