import { type SQLiteDatabase } from 'expo-sqlite';

import { nowIso } from '@/shared/utils/date';

import { type NewNote, type Note, type NotePatch } from '../types';

/** Pure data access for notes. No validation, no cross-feature calls. */
export const notesRepository = {
  /**
   * Inserts a note.
   *
   * @param db - Open connection.
   * @param n - Validated note input; `body` is assumed non-empty (the service checks).
   * @returns The new `Notes.Id`.
   * @remarks `CreatedAt`/`UpdatedAt` are left to the column DEFAULTs so the
   *          timestamp comes from SQLite, not from a device clock the user can
   *          change mid-session.
   */
  async create(db: SQLiteDatabase, n: NewNote): Promise<number> {
    const result = await db.runAsync(
      `INSERT INTO Notes
         (TopicId, BookId, Chapter, VerseStart, VerseEnd, TranslationId, Title, Body, Color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        n.topicId ?? null,
        n.bookId,
        n.chapter,
        n.verseStart,
        n.verseEnd ?? null,
        n.translationId ?? null,
        n.title ?? null,
        n.body,
        n.color ?? null,
      ],
    );
    return result.lastInsertRowId;
  },

  /**
   * @param db - Open connection.
   * @param id - `Notes.Id`.
   * @returns The note, or `null` if it was deleted.
   */
  getById(db: SQLiteDatabase, id: number): Promise<Note | null> {
    return db.getFirstAsync<Note>('SELECT * FROM Notes WHERE Id = ?', [id]);
  },

  /**
   * Notes anchored to a verse, including range notes that span it.
   *
   * @param db - Open connection.
   * @param bookId - Canonical book id.
   * @param chapter - Chapter number.
   * @param verse - The verse that must fall inside `[VerseStart, VerseEnd]`.
   * @returns Pinned first, then newest first. Empty when the verse has no notes.
   */
  listByVerse(
    db: SQLiteDatabase,
    bookId: number,
    chapter: number,
    verse: number,
  ): Promise<Note[]> {
    return db.getAllAsync<Note>(
      `SELECT * FROM Notes
        WHERE BookId = ? AND Chapter = ?
          AND VerseStart <= ? AND (VerseEnd IS NULL OR VerseEnd >= ?)
        ORDER BY IsPinned DESC, CreatedAt DESC`,
      [bookId, chapter, verse, verse],
    );
  },

  /**
   * Every note in one chapter — drives the reader's per-verse note markers.
   *
   * @param db - Open connection.
   * @param bookId - Canonical book id.
   * @param chapter - Chapter number.
   * @returns Notes ordered by the verse they start on.
   * @remarks One query per chapter instead of one per verse. A 176-verse chapter
   *          (Psalm 119) would otherwise mean 176 round-trips just to draw dots.
   *          Served by `IdxNotesRef (BookId, Chapter, VerseStart)`.
   */
  listByChapter(db: SQLiteDatabase, bookId: number, chapter: number): Promise<Note[]> {
    return db.getAllAsync<Note>(
      `SELECT * FROM Notes
        WHERE BookId = ? AND Chapter = ?
        ORDER BY VerseStart, CreatedAt DESC`,
      [bookId, chapter],
    );
  },

  /**
   * @param db - Open connection.
   * @param limit - Cap on rows, default 100.
   * @returns Pinned first, then newest first.
   */
  listRecent(db: SQLiteDatabase, limit = 100): Promise<Note[]> {
    return db.getAllAsync<Note>(
      'SELECT * FROM Notes ORDER BY IsPinned DESC, CreatedAt DESC LIMIT ?',
      [limit],
    );
  },

  /**
   * Notes created on a given local calendar day.
   *
   * @param db - Open connection.
   * @param day - Local day as 'YYYY-MM-DD'.
   * @returns Newest first. Empty when nothing was written that day.
   * @remarks `date(CreatedAt, 'localtime')` converts the stored UTC instant to
   *          the device's day before comparing — a note written at 08:00 Manila
   *          time is stored as the previous UTC day and would otherwise land on
   *          the wrong calendar square. The cost is that this predicate is not
   *          sargable, so `IdxNotesCreated` cannot seek it. Acceptable at
   *          personal-notes scale; revisit with a stored `CreatedOn` day column
   *          if it ever isn't.
   */
  listByDay(db: SQLiteDatabase, day: string): Promise<Note[]> {
    return db.getAllAsync<Note>(
      `SELECT * FROM Notes
        WHERE date(CreatedAt, 'localtime') = ?
        ORDER BY CreatedAt DESC`,
      [day],
    );
  },

  /**
   * Applies a partial update.
   *
   * @param db - Open connection.
   * @param id - `Notes.Id`.
   * @param patch - Only the provided keys are written.
   * @returns Resolves when written; a no-op (no SQL issued) for an empty patch.
   * @remarks The SET list is assembled from a fixed allow-list of column names —
   *          the *values* are always bound parameters, so no user input reaches
   *          the SQL string. This is the one place in the codebase that builds
   *          SQL dynamically; keep it column-name-only.
   */
  async update(db: SQLiteDatabase, id: number, patch: NotePatch): Promise<void> {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (patch.title !== undefined) {
      fields.push('Title = ?');
      values.push(patch.title);
    }
    if (patch.body !== undefined) {
      fields.push('Body = ?');
      values.push(patch.body);
    }
    if (patch.color !== undefined) {
      fields.push('Color = ?');
      values.push(patch.color);
    }
    if (patch.summary !== undefined) {
      fields.push('Summary = ?');
      values.push(patch.summary);
    }
    if (patch.isPinned !== undefined) {
      fields.push('IsPinned = ?');
      values.push(patch.isPinned ? 1 : 0);
    }
    if (fields.length === 0) return;

    fields.push('UpdatedAt = ?');
    values.push(nowIso());
    values.push(id);

    await db.runAsync(`UPDATE Notes SET ${fields.join(', ')} WHERE Id = ?`, values);
  },

  /**
   * Hard-deletes a note.
   *
   * @param db - Open connection.
   * @param id - `Notes.Id`.
   * @returns Resolves even when the id no longer exists.
   */
  async remove(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM Notes WHERE Id = ?', [id]);
  },
};
