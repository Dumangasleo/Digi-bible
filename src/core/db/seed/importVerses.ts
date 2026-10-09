import { type SQLiteDatabase } from 'expo-sqlite';

/**
 * One verse as supplied by an import source.
 *
 * `book` is the canonical book id (1..66, matching `Books.Id` / `CANON.id`)
 * rather than a name, because names differ per translation and matching on
 * them is the single most common way a Bible import silently corrupts itself.
 */
export interface ImportVerse {
  book: number;
  chapter: number;
  verse: number;
  text: string;
}

/** A localized book name for one translation, e.g. `{ book: 1, name: 'Genesis' }` in Tagalog. */
export interface ImportBookName {
  book: number;
  name: string;
  abbreviation?: string | null;
}

/** Everything one translation contributes to the database. */
export interface TranslationPayload {
  /** Must match a `Translations.Code` seeded by `seedBibleIfNeeded` — 'KJV' | 'ADB' | 'CEB'. */
  code: string;
  verses: ImportVerse[];
  bookNames?: ImportBookName[];
}

/**
 * Reports whether a translation already has verse text loaded.
 *
 * @param db - Open connection.
 * @param code - Translation code, e.g. 'KJV'.
 * @returns Verse count for that translation. `0` means "text not loaded yet",
 *          which is a normal state — not an error.
 * @remarks Drives the reader's empty state and the importer's idempotency guard.
 */
export async function countVerses(db: SQLiteDatabase, code: string): Promise<number> {
  const row = await db.getFirstAsync<{ N: number }>(
    `SELECT COUNT(*) AS N
       FROM Verses v
       JOIN Translations t ON t.Id = v.TranslationId
      WHERE t.Code = ?`,
    [code],
  );
  return row?.N ?? 0;
}

/**
 * Bulk-loads verse text (and optional localized book names) for one translation.
 *
 * @param db - Open connection.
 * @param payload - The translation's code plus its verses and book names.
 * @param options.force - Re-import even when verses already exist. Existing
 *                        rows for the translation are deleted first.
 * @returns Number of verses actually written. `0` means the guard short-circuited
 *          because text was already present — not a failure.
 * @throws {Error} If `payload.code` does not match a seeded translation. Failing
 *         here is deliberate: silently creating an unknown translation row would
 *         produce a Bible the reader can never select.
 * @throws {SQLiteError} On any constraint violation; the whole import rolls back.
 * @remarks **Transaction boundary** — the entire import is one transaction. Each
 *          INSERT autocommitted separately would mean ~31,000 fsyncs per
 *          translation; batching them makes a multi-minute operation a
 *          multi-second one, and guarantees the app can never observe a
 *          half-loaded Bible.
 *
 *          A single prepared statement is reused across the whole loop, so SQLite
 *          parses and plans the INSERT once instead of 31,000 times. It is
 *          finalized in a `finally` because a leaked statement keeps the
 *          connection's write lock alive.
 *
 *          The FTS triggers fire per row, so the search index is consistent the
 *          moment the transaction commits — no separate rebuild step to forget.
 *          That costs import speed; `rebuildSearchIndex` exists for the
 *          maintenance case where that trade is worth reversing.
 */
export async function importTranslation(
  db: SQLiteDatabase,
  payload: TranslationPayload,
  options: { force?: boolean } = {},
): Promise<number> {
  const translation = await db.getFirstAsync<{ Id: number }>(
    'SELECT Id FROM Translations WHERE Code = ?',
    [payload.code],
  );
  if (!translation) {
    throw new Error(
      `Unknown translation code "${payload.code}". Seed it in seedBible.ts first.`,
    );
  }
  const translationId = translation.Id;

  const existing = await countVerses(db, payload.code);
  if (existing > 0 && !options.force) return 0;

  let written = 0;

  await db.withTransactionAsync(async () => {
    if (existing > 0) {
      // Triggers cascade the removal into VersesFts, keeping search consistent.
      await db.runAsync('DELETE FROM Verses WHERE TranslationId = ?', [translationId]);
    }

    const insertVerse = await db.prepareAsync(
      `INSERT INTO Verses (TranslationId, BookId, Chapter, Verse, Text)
       VALUES ($translationId, $bookId, $chapter, $verse, $text)`,
    );
    try {
      for (const v of payload.verses) {
        await insertVerse.executeAsync({
          $translationId: translationId,
          $bookId: v.book,
          $chapter: v.chapter,
          $verse: v.verse,
          $text: v.text,
        });
        written++;
      }
    } finally {
      await insertVerse.finalizeAsync();
    }

    if (payload.bookNames?.length) {
      const insertName = await db.prepareAsync(
        `INSERT INTO BookNames (BookId, TranslationId, Name, Abbreviation)
         VALUES ($bookId, $translationId, $name, $abbreviation)
         ON CONFLICT (BookId, TranslationId) DO UPDATE SET
           Name = excluded.Name,
           Abbreviation = excluded.Abbreviation`,
      );
      try {
        for (const b of payload.bookNames) {
          await insertName.executeAsync({
            $bookId: b.book,
            $translationId: translationId,
            $name: b.name,
            $abbreviation: b.abbreviation ?? null,
          });
        }
      } finally {
        await insertName.finalizeAsync();
      }
    }

    // Backfill Chapters.VerseCount from what actually landed, so the reader can
    // show "verse 1 of 31" without counting rows on every render. Derived from
    // the data rather than trusted from the payload — the payload may be partial.
    await db.runAsync(
      `UPDATE Chapters
          SET VerseCount = COALESCE((
                SELECT COUNT(*) FROM Verses v
                 WHERE v.BookId = Chapters.BookId
                   AND v.Chapter = Chapters.Number
                   AND v.TranslationId = ?
              ), VerseCount)
        WHERE EXISTS (
                SELECT 1 FROM Verses v
                 WHERE v.BookId = Chapters.BookId
                   AND v.Chapter = Chapters.Number
                   AND v.TranslationId = ?
              )`,
      [translationId, translationId],
    );
  });

  return written;
}

/**
 * Rebuilds the full-text index from the `Verses` table.
 *
 * @param db - Open connection.
 * @returns Resolves once FTS5 has re-indexed every verse.
 * @remarks Only needed if the index and table drift apart — e.g. after a bulk
 *          load that deliberately bypassed the triggers, or a corrupted index.
 *          Normal imports keep FTS in sync via triggers and never need this.
 */
export async function rebuildSearchIndex(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(`INSERT INTO VersesFts(VersesFts) VALUES('rebuild')`);
}
