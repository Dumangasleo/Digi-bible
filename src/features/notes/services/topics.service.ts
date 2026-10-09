import { type SQLiteDatabase } from 'expo-sqlite';

import { notesRepository } from '../data/notes.repository';
import { topicsRepository } from '../data/topics.repository';
import {
  type NewTopic,
  type NewTopicVerse,
  type TopicDetail,
  type TopicItem,
  type TopicList,
  type TopicPatch,
  type TopicVerse,
  type TopicVerseRow,
} from '../types';

/**
 * Normalizes a set of word positions: whole, non-negative, unique, ascending.
 *
 * @param words - Positions as collected from taps, in any order.
 * @returns A clean list, safe to store and compare.
 * @remarks Tapping a word twice toggles it, so duplicates should never arrive —
 *          but the stored value is the contract, so it is cleaned here, at the
 *          boundary, rather than trusted from the UI.
 */
function normalizeWords(words: readonly number[]): number[] {
  return [...new Set(words.filter((w) => Number.isInteger(w) && w >= 0))].sort((a, b) => a - b);
}

/**
 * Parses the stored JSON of word positions.
 *
 * @param json - `NoteHighlights.WordIndexes`, or null when none exist.
 * @returns The positions; an empty list for null or anything malformed.
 * @remarks A corrupt value degrades to "no highlight" instead of crashing the
 *          whole topic page over one decoration.
 */
function parseWords(json: string | null): number[] {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? normalizeWords(value.filter((n) => typeof n === 'number')) : [];
  } catch {
    return [];
  }
}

/**
 * Turns a raw verse row into the shape the UI uses.
 *
 * @param row - A row from `topicsRepository.listVerses`.
 * @returns The verse with `Highlights` as a number list.
 */
function toTopicVerse({ HighlightsJson, ...rest }: TopicVerseRow): TopicVerse {
  return { ...rest, Highlights: parseWords(HighlightsJson) };
}

/** Business rules for study topics: validation, atomic creation, idempotent adds. */
export const topicsService = {
  /**
   * Creates a topic together with its first verse (and that verse's highlights).
   *
   * @param db - Open connection.
   * @param input - Title, optional description, the verse picked at creation,
   *                and any words highlighted on it before saving.
   * @returns The new topic's id.
   * @throws {Error} If the title is blank.
   * @remarks **Transaction boundary:** the topic, its first verse, and that
   *          verse's highlights commit together or not at all — no topic without
   *          a verse, and no half-saved highlight.
   */
  async createTopic(db: SQLiteDatabase, input: NewTopic): Promise<number> {
    const title = input.title.trim();
    if (!title) throw new Error('Topic title is required.');
    const words = normalizeWords(input.firstHighlights ?? []);

    let topicId = 0;
    await db.withTransactionAsync(async () => {
      topicId = await topicsRepository.create(db, {
        title,
        description: input.description?.trim() || null,
      });
      const noteId = await notesRepository.create(db, {
        topicId,
        bookId: input.firstVerse.bookId,
        chapter: input.firstVerse.chapter,
        verseStart: input.firstVerse.verse,
        translationId: input.translationId ?? null,
        body: '', // D3: a verse needs no note; Body is NOT NULL, so '' means "none"
      });
      if (words.length > 0 && input.translationId != null) {
        await topicsRepository.setHighlights(db, noteId, input.translationId, words);
      }
    });
    return topicId;
  },

  /**
   * Changes a topic's title and description.
   *
   * @param db - Open connection.
   * @param topicId - `Topics.Id`.
   * @param patch - New title (required) and description (blank clears it).
   * @throws {Error} If the title is blank.
   */
  async updateTopic(db: SQLiteDatabase, topicId: number, patch: TopicPatch): Promise<void> {
    const title = patch.title.trim();
    if (!title) throw new Error('Topic title is required.');
    await topicsRepository.update(db, topicId, {
      title,
      description: patch.description?.trim() || null,
    });
  },

  /**
   * Adds a verse to a topic — safely repeatable.
   *
   * @param db - Open connection.
   * @param input - Topic, verse, optional note, optional highlights.
   * @returns The note id — the existing one if the verse was already in the topic.
   * @remarks Idempotent: adding a verse that is already there does not duplicate
   *          it. If highlights came with the second add, they replace the old
   *          ones for that language — the latest selection is what the user meant.
   *          **Transaction boundary:** the verse and its highlights commit together.
   */
  async addVerse(db: SQLiteDatabase, input: NewTopicVerse): Promise<number> {
    const words = normalizeWords(input.highlights ?? []);
    let noteId = 0;

    await db.withTransactionAsync(async () => {
      const existing = await topicsRepository.findVerse(db, input.topicId, input);
      noteId =
        existing?.Id ??
        (await notesRepository.create(db, {
          topicId: input.topicId,
          bookId: input.bookId,
          chapter: input.chapter,
          verseStart: input.verse,
          translationId: input.translationId ?? null,
          body: input.body?.trim() ?? '',
        }));
      if (words.length > 0 && input.translationId != null) {
        await topicsRepository.setHighlights(db, noteId, input.translationId, words);
      }
    });
    return noteId;
  },

  /**
   * Replaces the highlighted words of a filed verse in one language.
   *
   * @param db - Open connection.
   * @param noteId - `Notes.Id` of the verse.
   * @param translationId - The language the positions refer to.
   * @param words - Positions; an empty list removes the highlight.
   */
  setHighlights: (
    db: SQLiteDatabase,
    noteId: number,
    translationId: number,
    words: readonly number[],
  ): Promise<void> =>
    topicsRepository.setHighlights(db, noteId, translationId, normalizeWords(words)),

  /**
   * Appends a description block after everything already in the topic.
   *
   * @param db - Open connection.
   * @param topicId - `Topics.Id`.
   * @param body - The text.
   * @returns The new block's id.
   * @throws {Error} If the text is blank.
   */
  async addText(db: SQLiteDatabase, topicId: number, body: string): Promise<number> {
    const text = body.trim();
    if (!text) throw new Error('Write something first.');
    return topicsRepository.createText(db, topicId, text);
  },

  /**
   * Rewrites a description block in place.
   *
   * @param db - Open connection.
   * @param textId - `TopicTexts.Id`.
   * @param body - The new text.
   * @throws {Error} If the text is blank — delete the block instead.
   */
  async editText(db: SQLiteDatabase, textId: number, body: string): Promise<void> {
    const text = body.trim();
    if (!text) throw new Error('Write something first, or delete the description.');
    await topicsRepository.updateText(db, textId, text);
  },

  /**
   * Deletes a description block.
   *
   * @param db - Open connection.
   * @param textId - `TopicTexts.Id`.
   */
  removeText: (db: SQLiteDatabase, textId: number): Promise<void> =>
    topicsRepository.removeText(db, textId),

  /**
   * Loads everything the topics list screen shows.
   *
   * @param db - Open connection.
   * @returns All topic summaries plus the "Walay Topic" count.
   */
  async listTopics(db: SQLiteDatabase): Promise<TopicList> {
    const [topics, uncategorizedCount] = await Promise.all([
      topicsRepository.listSummaries(db),
      topicsRepository.countUncategorized(db),
    ]);
    return { topics, uncategorizedCount };
  },

  /**
   * Loads one topic: its verses, its description blocks, and both merged in the
   * order they were added.
   *
   * @param db - Open connection.
   * @param topicId - `Topics.Id`, or `null` for the "Walay Topic" group.
   * @param translationId - Translation to show verse text and highlights in.
   * @returns The topic (null for "Walay Topic" or a deleted topic), its verses,
   *          and the merged `items`.
   * @remarks **Order is creation time** — no position column to maintain. A
   *          description added after five verses sorts after them, and every
   *          verse added later sorts after it, which is exactly "a description
   *          explains the verses that follow". Both tables stamp `CreatedAt` with
   *          millisecond precision from the same SQLite clock, so the merge is
   *          stable; ties (practically impossible) put the verse first.
   */
  async getTopicDetail(
    db: SQLiteDatabase,
    topicId: number | null,
    translationId: number,
  ): Promise<TopicDetail> {
    const [topic, rows, texts] = await Promise.all([
      topicId == null ? Promise.resolve(null) : topicsRepository.getById(db, topicId),
      topicsRepository.listVerses(db, topicId, translationId),
      topicId == null ? Promise.resolve([]) : topicsRepository.listTexts(db, topicId),
    ]);
    const verses = rows.map(toTopicVerse);

    const items: TopicItem[] = [
      ...verses.map(
        (verse): TopicItem => ({
          kind: 'verse',
          key: `v${verse.NoteId}`,
          createdAt: verse.CreatedAt,
          verse,
        }),
      ),
      ...texts.map(
        (text): TopicItem => ({ kind: 'text', key: `t${text.Id}`, createdAt: text.CreatedAt, text }),
      ),
    ].sort((a, b) =>
      a.createdAt === b.createdAt
        ? a.kind === b.kind
          ? 0
          : a.kind === 'verse'
            ? -1
            : 1
        : a.createdAt < b.createdAt
          ? -1
          : 1,
    );

    return { topic, verses, items };
  },

  /**
   * Removes one verse from its topic (deletes that note; its highlights cascade).
   *
   * @param db - Open connection.
   * @param noteId - `Notes.Id` of the verse entry.
   */
  removeVerse: (db: SQLiteDatabase, noteId: number): Promise<void> =>
    notesRepository.remove(db, noteId),

  /**
   * Deletes a topic; its verses move to "Walay Topic" (D2) and its description
   * blocks are deleted with it (CASCADE).
   *
   * @param db - Open connection.
   * @param topicId - `Topics.Id`.
   */
  deleteTopic: (db: SQLiteDatabase, topicId: number): Promise<void> =>
    topicsRepository.remove(db, topicId),
};
