import { type SQLiteDatabase } from 'expo-sqlite';

import { CANON } from './canon';

/**
 * The three shipped translations. Verse text for each is loaded separately by
 * `importVerses` — this seed only establishes the immutable reference
 * skeleton so the reader, scheduler, and notes can resolve book/chapter
 * references immediately, even before a single verse exists.
 */
const TRANSLATIONS = [
  { code: 'KJV', name: 'King James Version', language: 'en' },
  { code: 'ADB', name: 'Ang Dating Biblia', language: 'tl' },
  { code: 'CEB', name: 'Cebuano Pinadayag', language: 'ceb' },
] as const;

/**
 * Idempotently seeds reference data (translations, books, chapters, English
 * book names).
 *
 * @param db - Open connection supplied by `SQLiteProvider`.
 * @returns Resolves when reference data exists. Returns immediately (no writes)
 *          on every launch after the first.
 * @throws {SQLiteError} If the schema has not been migrated yet, or a seed
 *         INSERT violates a constraint. The transaction rolls back whole, so a
 *         failure can never leave a half-seeded canon behind.
 * @remarks Runs inside a single transaction — ~1,200 INSERTs (66 books + 1,189
 *          chapters + names) autocommitted one-by-one would mean 1,200 fsyncs
 *          and a visibly slow first launch. Guarded by a row count rather than
 *          `INSERT OR IGNORE` so the common path is one cheap COUNT, not 1,200
 *          no-op writes.
 *
 *          Localized (Tagalog/Bisaya) book names are added by `importVerses`;
 *          the bible repository COALESCEs back to the English name until then.
 */
export async function seedBibleIfNeeded(db: SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync<{ N: number }>(
    'SELECT COUNT(*) AS N FROM Translations',
  );
  if ((existing?.N ?? 0) > 0) return;

  await db.withTransactionAsync(async () => {
    for (const t of TRANSLATIONS) {
      await db.runAsync(
        'INSERT INTO Translations (Code, Name, Language) VALUES (?, ?, ?)',
        [t.code, t.name, t.language],
      );
    }

    const kjv = await db.getFirstAsync<{ Id: number }>(
      'SELECT Id FROM Translations WHERE Code = ?',
      ['KJV'],
    );
    // Non-null by construction: KJV was inserted two statements ago, inside
    // this same transaction.
    const kjvId = kjv!.Id;

    for (const b of CANON) {
      await db.runAsync(
        `INSERT INTO Books (Id, OsisCode, Testament, CanonicalOrder, ChapterCount)
         VALUES (?, ?, ?, ?, ?)`,
        [b.id, b.osis, b.testament, b.id, b.chapters],
      );
      await db.runAsync(
        'INSERT INTO BookNames (BookId, TranslationId, Name) VALUES (?, ?, ?)',
        [b.id, kjvId, b.name],
      );
      for (let chapter = 1; chapter <= b.chapters; chapter++) {
        // VerseCount is backfilled by importVerses once text is loaded.
        await db.runAsync(
          'INSERT INTO Chapters (BookId, Number, VerseCount) VALUES (?, ?, 0)',
          [b.id, chapter],
        );
      }
    }
  });
}
