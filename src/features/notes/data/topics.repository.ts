import { type SQLiteDatabase } from 'expo-sqlite';

import { nowIso } from '@/shared/utils/date';

import {
  type Topic,
  type TopicSummary,
  type TopicText,
  type TopicVerseRow,
  type VerseRef,
} from '../types';

/** Pure data access for study topics. No validation, no business rules. */
export const topicsRepository = {
  /**
   * Inserts a topic row.
   *
   * @param db - Open connection.
   * @param t - Already-validated title and description.
   * @returns The new `Topics.Id`.
   */
  async create(
    db: SQLiteDatabase,
    t: { title: string; description: string | null },
  ): Promise<number> {
    const result = await db.runAsync(
      'INSERT INTO Topics (Title, Description) VALUES (?, ?)',
      [t.title, t.description],
    );
    return result.lastInsertRowId;
  },

  /**
   * Every topic with its verse count and first verse, newest topic first.
   *
   * @param db - Open connection.
   * @returns One row per topic. Empty when no topic exists yet.
   * @remarks The first verse is the lowest `Notes.Id` in the topic — the one
   *          picked at creation. It is derived, not stored on `Topics`, so it can
   *          never drift out of sync with the topic's actual verses. Both
   *          subqueries are served by `IdxNotesTopicVerse` (TopicId leads).
   */
  listSummaries(db: SQLiteDatabase): Promise<TopicSummary[]> {
    return db.getAllAsync<TopicSummary>(
      `SELECT t.Id, t.Title, t.Description, t.CreatedAt, t.UpdatedAt,
              (SELECT COUNT(*) FROM Notes c WHERE c.TopicId = t.Id) AS VerseCount,
              f.BookId     AS FirstBookId,
              f.Chapter    AS FirstChapter,
              f.VerseStart AS FirstVerse
         FROM Topics t
         LEFT JOIN Notes f
                ON f.Id = (SELECT MIN(m.Id) FROM Notes m WHERE m.TopicId = t.Id)
        ORDER BY t.CreatedAt DESC`,
    );
  },

  /**
   * @param db - Open connection.
   * @returns How many notes have no topic — the "Walay Topic" group size.
   */
  async countUncategorized(db: SQLiteDatabase): Promise<number> {
    const row = await db.getFirstAsync<{ N: number }>(
      'SELECT COUNT(*) AS N FROM Notes WHERE TopicId IS NULL',
    );
    return row?.N ?? 0;
  },

  /**
   * @param db - Open connection.
   * @param id - `Topics.Id`.
   * @returns The topic, or `null` if it was deleted.
   */
  getById(db: SQLiteDatabase, id: number): Promise<Topic | null> {
    return db.getFirstAsync<Topic>('SELECT * FROM Topics WHERE Id = ?', [id]);
  },

  /**
   * The verses in a topic, each joined with its text in one translation.
   *
   * @param db - Open connection.
   * @param topicId - `Topics.Id`, or `null` for the "Walay Topic" group.
   * @param translationId - Translation to show the verse text (and highlights) in.
   * @returns Verses in the order they were added. `Text` is null for a verse
   *          whose translation text is not imported — a normal state.
   *          `HighlightsJson` is null when nothing is highlighted in that language.
   * @remarks `TopicId IS ?` handles both cases in one query: with a number it
   *          behaves like `=`, with null like `IS NULL`. Plain `= ?` would never
   *          match null — `NULL = NULL` is not true in SQL.
   *
   *          One JOIN instead of one verse lookup per note (the N+1 trap). The
   *          join is a seek on the `Verses` UNIQUE index per row; the highlights
   *          join is a seek on the `NoteHighlights` primary key.
   */
  listVerses(
    db: SQLiteDatabase,
    topicId: number | null,
    translationId: number,
  ): Promise<TopicVerseRow[]> {
    return db.getAllAsync<TopicVerseRow>(
      `SELECT n.Id AS NoteId, n.BookId, n.Chapter, n.VerseStart, n.VerseEnd,
              n.Title, n.Body, n.CreatedAt,
              v.Text,
              h.WordIndexes AS HighlightsJson
         FROM Notes n
         LEFT JOIN Verses v
                ON v.TranslationId = ?
               AND v.BookId  = n.BookId
               AND v.Chapter = n.Chapter
               AND v.Verse   = n.VerseStart
         LEFT JOIN NoteHighlights h
                ON h.NoteId = n.Id AND h.TranslationId = ?
        WHERE n.TopicId IS ?
        ORDER BY n.Id`,
      [translationId, translationId, topicId],
    );
  },

  /**
   * Updates a topic's title and description.
   *
   * @param db - Open connection.
   * @param id - `Topics.Id`.
   * @param t - Already-validated values.
   * @returns Resolves even if the topic no longer exists.
   */
  async update(
    db: SQLiteDatabase,
    id: number,
    t: { title: string; description: string | null },
  ): Promise<void> {
    await db.runAsync(
      'UPDATE Topics SET Title = ?, Description = ?, UpdatedAt = ? WHERE Id = ?',
      [t.title, t.description, nowIso(), id],
    );
  },

  /**
   * The description blocks of a topic, oldest first.
   *
   * @param db - Open connection.
   * @param topicId - `Topics.Id`.
   * @returns Blocks in the order they were added; served by `IdxTopicTextsTopic`.
   */
  listTexts(db: SQLiteDatabase, topicId: number): Promise<TopicText[]> {
    return db.getAllAsync<TopicText>(
      'SELECT * FROM TopicTexts WHERE TopicId = ? ORDER BY CreatedAt, Id',
      [topicId],
    );
  },

  /**
   * Appends a description block to a topic.
   *
   * @param db - Open connection.
   * @param topicId - `Topics.Id`.
   * @param body - Already-validated text.
   * @returns The new `TopicTexts.Id`.
   */
  async createText(db: SQLiteDatabase, topicId: number, body: string): Promise<number> {
    const result = await db.runAsync('INSERT INTO TopicTexts (TopicId, Body) VALUES (?, ?)', [
      topicId,
      body,
    ]);
    return result.lastInsertRowId;
  },

  /**
   * Rewrites a description block. Its position does not change — position is
   * `CreatedAt`, which an edit leaves alone.
   *
   * @param db - Open connection.
   * @param id - `TopicTexts.Id`.
   * @param body - Already-validated text.
   */
  async updateText(db: SQLiteDatabase, id: number, body: string): Promise<void> {
    await db.runAsync('UPDATE TopicTexts SET Body = ?, UpdatedAt = ? WHERE Id = ?', [
      body,
      nowIso(),
      id,
    ]);
  },

  /**
   * Deletes a description block.
   *
   * @param db - Open connection.
   * @param id - `TopicTexts.Id`.
   */
  async removeText(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM TopicTexts WHERE Id = ?', [id]);
  },

  /**
   * Stores a verse's highlighted words for one translation, replacing any before.
   *
   * @param db - Open connection.
   * @param noteId - `Notes.Id` of the filed verse.
   * @param translationId - The language the word positions refer to.
   * @param wordIndexes - Normalized positions; an empty list clears the highlight.
   * @remarks Upsert on the (NoteId, TranslationId) primary key; clearing deletes
   *          the row rather than storing '[]', so "no highlight" has exactly one
   *          representation.
   */
  async setHighlights(
    db: SQLiteDatabase,
    noteId: number,
    translationId: number,
    wordIndexes: number[],
  ): Promise<void> {
    if (wordIndexes.length === 0) {
      await db.runAsync('DELETE FROM NoteHighlights WHERE NoteId = ? AND TranslationId = ?', [
        noteId,
        translationId,
      ]);
      return;
    }
    await db.runAsync(
      `INSERT INTO NoteHighlights (NoteId, TranslationId, WordIndexes)
       VALUES (?, ?, ?)
       ON CONFLICT (NoteId, TranslationId) DO UPDATE SET WordIndexes = excluded.WordIndexes`,
      [noteId, translationId, JSON.stringify(wordIndexes)],
    );
  },

  /**
   * Finds a verse already filed under a topic.
   *
   * @param db - Open connection.
   * @param topicId - `Topics.Id`.
   * @param ref - The verse to look for.
   * @returns `{ Id }` of the existing note, or `null` if the verse is not in the topic.
   */
  findVerse(
    db: SQLiteDatabase,
    topicId: number,
    ref: VerseRef,
  ): Promise<{ Id: number } | null> {
    return db.getFirstAsync<{ Id: number }>(
      `SELECT Id FROM Notes
        WHERE TopicId = ? AND BookId = ? AND Chapter = ? AND VerseStart = ?`,
      [topicId, ref.bookId, ref.chapter, ref.verse],
    );
  },

  /**
   * Deletes a topic. Its verses are NOT deleted.
   *
   * @param db - Open connection.
   * @param id - `Topics.Id`.
   * @returns Resolves even if the topic no longer exists.
   * @remarks `ON DELETE SET NULL` moves the topic's notes to "Walay Topic" (D2).
   *          That only fires with `PRAGMA foreign_keys = ON` — see init.ts.
   */
  async remove(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM Topics WHERE Id = ?', [id]);
  },
};