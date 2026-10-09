import { type SQLiteDatabase } from 'expo-sqlite';

import { notesRepository } from '../data/notes.repository';
import { type NewNote, type Note, type NotePatch } from '../types';
// import { summarizer } from '@/core/ai'; // 🔮 wired in the AI phase

/**
 * Business logic for note-taking. This is the layer where the future LLM
 * summarization plugs in — callers (UI/hooks) never change when it does.
 */
export const notesService = {
  /**
   * Validates and persists a new note.
   *
   * @param db - Open connection.
   * @param input - The note to create.
   * @returns The new note's id.
   * @throws {Error} If the body is blank. Rejected here, at the boundary, rather
   *         than relying on the UI to disable a button — the service is the
   *         contract, the button is a convenience.
   */
  async addNote(db: SQLiteDatabase, input: NewNote): Promise<number> {
    if (!input.body.trim()) {
      throw new Error('Note body cannot be empty.');
    }
    // 🔮 Future: generate and store a summary before/after persisting, e.g.
    //   const summary = await summarizer.summarize(input.body);
    //   ...then notesRepository.update(db, id, { summary })
    return notesRepository.create(db, input);
  },

  /**
   * @param db - Open connection.
   * @param bookId - Canonical book id.
   * @param chapter - Chapter number.
   * @param verse - Verse number.
   * @returns Notes covering that verse; empty when there are none.
   */
  getForVerse(
    db: SQLiteDatabase,
    bookId: number,
    chapter: number,
    verse: number,
  ): Promise<Note[]> {
    return notesRepository.listByVerse(db, bookId, chapter, verse);
  },

  /**
   * @param db - Open connection.
   * @param bookId - Canonical book id.
   * @param chapter - Chapter number.
   * @returns Every note in the chapter, for the reader's verse markers.
   */
  getForChapter: (db: SQLiteDatabase, bookId: number, chapter: number): Promise<Note[]> =>
    notesRepository.listByChapter(db, bookId, chapter),

  listRecent: (db: SQLiteDatabase, limit?: number): Promise<Note[]> =>
    notesRepository.listRecent(db, limit),

  listForDay: (db: SQLiteDatabase, day: string): Promise<Note[]> =>
    notesRepository.listByDay(db, day),

  editNote: (db: SQLiteDatabase, id: number, patch: NotePatch): Promise<void> =>
    notesRepository.update(db, id, patch),

  deleteNote: (db: SQLiteDatabase, id: number): Promise<void> =>
    notesRepository.remove(db, id),

  /**
   * Flips a note's pinned flag.
   *
   * @param db - Open connection.
   * @param id - `Notes.Id`.
   * @returns Resolves silently when the note no longer exists.
   * @remarks Read-then-write, not an in-place `IsPinned = 1 - IsPinned`, because
   *          the read is also the existence check. Two statements without an
   *          explicit transaction is safe here: a single-user local DB with no
   *          concurrent writer, and a lost race would at worst leave the pin in
   *          the state the other tap asked for.
   */
  async togglePin(db: SQLiteDatabase, id: number): Promise<void> {
    const note = await notesRepository.getById(db, id);
    if (!note) return;
    await notesRepository.update(db, id, { isPinned: note.IsPinned === 0 });
  },
};
