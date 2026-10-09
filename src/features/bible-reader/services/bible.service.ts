import { type SQLiteDatabase } from 'expo-sqlite';

import { bibleRepository } from '../data/bible.repository';
import { type Book, type SearchHit, type Translation, type Verse } from '../types';

/**
 * Business logic for the reader. Wraps the repository and adds behavior the UI
 * shouldn't own — e.g. turning a raw search box string into a safe FTS query.
 */
export const bibleService = {
  listTranslations: (db: SQLiteDatabase): Promise<Translation[]> =>
    bibleRepository.listTranslations(db),

  getTranslationByCode: (db: SQLiteDatabase, code: string): Promise<Translation | null> =>
    bibleRepository.getTranslationByCode(db, code),

  listBooks: (db: SQLiteDatabase, translationId: number): Promise<Book[]> =>
    bibleRepository.listBooks(db, translationId),

  getChapter: (
    db: SQLiteDatabase,
    translationId: number,
    bookId: number,
    chapter: number,
  ): Promise<Verse[]> => bibleRepository.getChapter(db, translationId, bookId, chapter),

  getVerse: (
    db: SQLiteDatabase,
    translationId: number,
    bookId: number,
    chapter: number,
    verse: number,
  ): Promise<Verse | null> =>
    bibleRepository.getVerse(db, translationId, bookId, chapter, verse),

  getVerseCount: (db: SQLiteDatabase, bookId: number, chapter: number): Promise<number> =>
    bibleRepository.getVerseCount(db, bookId, chapter),

  /**
   * Search-as-you-type across English, Tagalog and Bisaya at once: prefix-matches
   * each term, neutralizes FTS operators, and keeps one hit per verse.
   *
   * @param db - Open connection.
   * @param rawQuery - Exactly what the user typed, in any of the three languages.
   * @returns Relevance-ranked hits, one per verse reference, or an empty array for
   *          queries under two characters (a one-letter prefix matches most of
   *          the Bible and is slow for a result nobody wants).
   * @remarks FTS5 treats `"`, `*`, `^`, `AND`, `NEAR` and friends as syntax. A
   *          raw apostrophe or quote from a user would either throw a parse error
   *          or silently change the query's meaning, so the operator characters
   *          are stripped and a single trailing `*` is appended per term to get
   *          prefix matching. This is the sanitization boundary — the repository
   *          trusts whatever arrives, so nothing may reach it un-sanitized.
   *
   *          Note this is not an injection defence (the term is a bound
   *          parameter either way) but a *correctness* one.
   *
   *          **Dedupe is a business rule, so it lives here.** A name such as
   *          "Abraham" matches all three translations of the same verse — 50 raw
   *          hits collapse to 23 distinct verses. Hits arrive best-first, so the
   *          first occurrence of each reference is the one kept.
   */
  async search(db: SQLiteDatabase, rawQuery: string): Promise<SearchHit[]> {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) return [];
    const ftsQuery = trimmed
      .split(/\s+/)
      .map((term) => term.replace(/["*^():-]/g, ''))
      .filter((term) => term.length > 0)
      .map((term) => `${term}*`)
      .join(' ');
    if (!ftsQuery) return [];

    const hits = await bibleRepository.search(db, ftsQuery);
    const seen = new Set<string>();
    return hits.filter((hit) => {
      const key = `${hit.BookId}:${hit.Chapter}:${hit.Verse}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },
};
