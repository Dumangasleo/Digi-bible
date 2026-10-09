import { type SQLiteDatabase } from 'expo-sqlite';

import { type Book, type SearchHit, type Translation, type Verse } from '../types';

/**
 * Data-access layer for immutable Bible content. Pure SQL — no business rules,
 * no UI. Every method takes the DB connection so it stays trivially testable.
 *
 * @remarks Every query is parameterized. No user-supplied value is ever
 *          concatenated into SQL, including the search term — FTS queries go
 *          through a bound `?` and are sanitized by the service before arrival.
 */
export const bibleRepository = {
  /**
   * Lists the installed translations in seed order.
   *
   * @param db - Open connection.
   * @returns All translation rows. Never empty after `seedBibleIfNeeded` runs.
   */
  listTranslations(db: SQLiteDatabase): Promise<Translation[]> {
    return db.getAllAsync<Translation>('SELECT * FROM Translations ORDER BY Id');
  },

  /**
   * Resolves a translation code to its row.
   *
   * @param db - Open connection.
   * @param code - Translation code, e.g. 'KJV'.
   * @returns The row, or `null` when the code is not installed.
   */
  getTranslationByCode(db: SQLiteDatabase, code: string): Promise<Translation | null> {
    return db.getFirstAsync<Translation>('SELECT * FROM Translations WHERE Code = ?', [
      code,
    ]);
  },

  /**
   * Books with names localized to `translationId`, falling back to the English
   * (KJV) name via COALESCE when a localized name has not been loaded yet.
   *
   * @param db - Open connection.
   * @param translationId - `Translations.Id` to localize names for.
   * @returns All 66 books in canonical order. The fallback means this is never
   *          short, even before any localized name is imported.
   */
  listBooks(db: SQLiteDatabase, translationId: number): Promise<Book[]> {
    return db.getAllAsync<Book>(
      `SELECT b.Id, b.OsisCode, b.Testament, b.CanonicalOrder, b.ChapterCount,
              COALESCE(bn.Name, bnEn.Name) AS Name
         FROM Books b
         LEFT JOIN BookNames bn
                ON bn.BookId = b.Id AND bn.TranslationId = ?
         LEFT JOIN BookNames bnEn
                ON bnEn.BookId = b.Id
               AND bnEn.TranslationId = (SELECT Id FROM Translations WHERE Code = 'KJV')
        ORDER BY b.CanonicalOrder`,
      [translationId],
    );
  },

  /**
   * Loads one chapter's verses.
   *
   * @param db - Open connection.
   * @param translationId - `Translations.Id`.
   * @param bookId - Canonical book id, 1..66.
   * @param chapter - 1-based chapter number; not validated against book length.
   * @returns Verses ordered ascending. An empty array means either "chapter does
   *          not exist" or "text not imported yet" — callers must treat empty as
   *          a normal state, never as an error.
   * @remarks Served entirely by the `UNIQUE (TranslationId, BookId, Chapter, Verse)`
   *          index as a range scan on its three leading columns.
   */
  getChapter(
    db: SQLiteDatabase,
    translationId: number,
    bookId: number,
    chapter: number,
  ): Promise<Verse[]> {
    return db.getAllAsync<Verse>(
      `SELECT * FROM Verses
        WHERE TranslationId = ? AND BookId = ? AND Chapter = ?
        ORDER BY Verse`,
      [translationId, bookId, chapter],
    );
  },

  /**
   * Loads a single verse.
   *
   * @param db - Open connection.
   * @param translationId - `Translations.Id`.
   * @param bookId - Canonical book id, 1..66.
   * @param chapter - 1-based chapter number.
   * @param verse - 1-based verse number.
   * @returns The verse, or `null` if it does not exist in this translation.
   */
  getVerse(
    db: SQLiteDatabase,
    translationId: number,
    bookId: number,
    chapter: number,
    verse: number,
  ): Promise<Verse | null> {
    return db.getFirstAsync<Verse>(
      `SELECT * FROM Verses
        WHERE TranslationId = ? AND BookId = ? AND Chapter = ? AND Verse = ?`,
      [translationId, bookId, chapter, verse],
    );
  },

  /**
   * Number of verses in one chapter.
   *
   * @param db - Open connection.
   * @param bookId - Canonical book id, 1..66.
   * @param chapter - 1-based chapter number.
   * @returns The verse count, or 0 if no translation's text has been imported.
   * @remarks Reads `Chapters.VerseCount`, which `importTranslation` backfills —
   *          one seek on `UNIQUE (BookId, Number)`. Counting `Verses` instead
   *          could not use its index (it leads with TranslationId) and would
   *          scan all 93k rows.
   */
  async getVerseCount(db: SQLiteDatabase, bookId: number, chapter: number): Promise<number> {
    const row = await db.getFirstAsync<{ N: number }>(
      'SELECT VerseCount AS N FROM Chapters WHERE BookId = ? AND Number = ?',
      [bookId, chapter],
    );
    return row?.N ?? 0;
  },

  /**
   * Relevance-ranked full-text search across every installed translation.
   *
   * @param db - Open connection.
   * @param ftsQuery - An already-sanitized FTS5 expression from the service.
   *                   Never pass raw user input here.
   * @param limit - Maximum hits, default 50.
   * @returns Hits ordered by BM25 relevance, each tagged with the translation it
   *          matched in. The same verse can appear once per translation — the
   *          service collapses those. Empty when nothing matches.
   * @remarks No translation filter, on purpose: "faith", "pananampalataya" and
   *          "pagtoo" each only exist in one language's text, so searching all
   *          three at once is what lets a user type in whichever language they
   *          think in. One FTS index already covers all 93k rows, so this costs
   *          no more than a single-translation search. `Translations` is joined
   *          only to label each hit.
   */
  search(db: SQLiteDatabase, ftsQuery: string, limit = 50): Promise<SearchHit[]> {
    return db.getAllAsync<SearchHit>(
      `SELECT v.*, t.Code AS TranslationCode
         FROM VersesFts f
         JOIN Verses v ON v.Id = f.rowid
         JOIN Translations t ON t.Id = v.TranslationId
        WHERE f.Text MATCH ?
        ORDER BY bm25(VersesFts)
        LIMIT ?`,
      [ftsQuery, limit],
    );
  },
};
