import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import { notesService } from '../services/notes.service';
import { type NewNote, type NotePatch } from '../types';

/**
 * Binds the notes service to the active DB connection so components get a
 * clean, DB-free API:  const notes = useNotes(); await notes.add({...});
 *
 * @returns A stable object of note operations.
 * @remarks Memoized on `db`, which is itself stable for the app's lifetime.
 *          Without this the object would be a new identity every render and
 *          would invalidate every `useEffect`/`useCallback` that depends on it.
 */
export function useNotes() {
  const db = useSQLiteContext();
  return useMemo(
    () => ({
      add: (input: NewNote) => notesService.addNote(db, input),
      forVerse: (bookId: number, chapter: number, verse: number) =>
        notesService.getForVerse(db, bookId, chapter, verse),
      forChapter: (bookId: number, chapter: number) =>
        notesService.getForChapter(db, bookId, chapter),
      listRecent: (limit?: number) => notesService.listRecent(db, limit),
      listForDay: (day: string) => notesService.listForDay(db, day),
      edit: (id: number, patch: NotePatch) => notesService.editNote(db, id, patch),
      remove: (id: number) => notesService.deleteNote(db, id),
      togglePin: (id: number) => notesService.togglePin(db, id),
    }),
    [db],
  );
}
