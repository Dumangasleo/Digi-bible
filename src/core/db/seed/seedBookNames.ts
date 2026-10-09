import { type SQLiteDatabase } from 'expo-sqlite';

import { LOCALIZED_BOOK_NAMES } from './bookNames';

/**
 * Brings the Tagalog and Bisaya book names in the database in line with
 * `LOCALIZED_BOOK_NAMES`, writing only what differs.
 *
 * @param db - Open connection; `Translations` and `Books` must already be seeded.
 * @returns Resolves once the names match. On a normal launch that is two reads
 *          and zero writes.
 * @throws {Error} If a names list is not exactly 66 long — a missing or extra
 *         entry would shift every later book onto the wrong id (Job labelled as
 *         Psalms), which must fail loudly rather than ship silently.
 * @throws {SQLiteError} If a write fails; the transaction rolls back whole.
 * @remarks **Why not a migration:** migrations run before the seed, so on a fresh
 *          install the `Books` and `Translations` rows these names point at would
 *          not exist yet. And a migration runs once — a later spelling fix would
 *          then need another migration. Diffing on every launch makes this both
 *          fresh-install-safe and self-correcting: fix a name in bookNames.ts,
 *          push an update, and existing phones pick it up on next open.
 *
 *          **Why diff before writing:** the check is two cheap SELECTs; skipping
 *          the 132 upserts when nothing changed keeps launch free of writes.
 *
 *          **Transaction boundary:** all changed names for both translations are
 *          written in one transaction, so the reader never shows a half-renamed
 *          Bible.
 */
export async function seedBookNames(db: SQLiteDatabase): Promise<void> {
  const changes: { bookId: number; translationId: number; name: string }[] = [];

  for (const [code, names] of Object.entries(LOCALIZED_BOOK_NAMES)) {
    if (names.length !== 66) {
      throw new Error(`LOCALIZED_BOOK_NAMES.${code} has ${names.length} names, expected 66.`);
    }

    const translation = await db.getFirstAsync<{ Id: number }>(
      'SELECT Id FROM Translations WHERE Code = ?',
      [code],
    );
    if (!translation) continue; // translation not installed — nothing to name

    const existing = await db.getAllAsync<{ BookId: number; Name: string }>(
      'SELECT BookId, Name FROM BookNames WHERE TranslationId = ?',
      [translation.Id],
    );
    const current = new Map(existing.map((row) => [row.BookId, row.Name]));

    names.forEach((name, index) => {
      const bookId = index + 1; // canonical order: index 0 is Genesis, id 1
      if (current.get(bookId) !== name) {
        changes.push({ bookId, translationId: translation.Id, name });
      }
    });
  }

  if (changes.length === 0) return;

  await db.withTransactionAsync(async () => {
    for (const c of changes) {
      await db.runAsync(
        `INSERT INTO BookNames (BookId, TranslationId, Name)
         VALUES (?, ?, ?)
         ON CONFLICT (BookId, TranslationId) DO UPDATE SET Name = excluded.Name`,
        [c.bookId, c.translationId, c.name],
      );
    }
  });
}
