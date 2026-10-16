import { type SQLiteDatabase } from 'expo-sqlite';

import { migrateDbIfNeeded } from './migrations';
import { BUNDLED_TRANSLATIONS } from './seed/bundledTranslations';
import { countVerses, importTranslation } from './seed/importVerses';
import { seedBibleIfNeeded } from './seed/seedBible';
import { seedBookNames } from './seed/seedBookNames';

/**
 * Single entry point passed to `<SQLiteProvider onInit>`. Runs once when the
 * database connection opens.
 *
 * @param db - The connection expo-sqlite just opened.
 * @returns Resolves when the database is ready to query.
 * @throws {SQLiteError} If a migration or seed fails. Deliberately not caught:
 *         the root layout's `ErrorBoundary` renders the message, which is far
 *         more useful than an app that starts against a broken schema and fails
 *         later with "no such table".
 * @remarks **Order matters and is not negotiable.** Migrations create the tables;
 *          the seed fills the canon skeleton the importer's foreign keys point
 *          at; the import needs both. Each step is individually idempotent, so
 *          launch two and three are a `PRAGMA` read, a `COUNT(*)`, and one
 *          `COUNT(*)` per registered translation.
 *
 *          Verse import runs here, inside the Suspense boundary, rather than
 *          lazily behind the reader. A half-imported Bible is a worse experience
 *          than a slower first launch: search would return partial results and
 *          the verse of the day would rotate over an incomplete set.
 *
 *          The verse count is checked *before* `load()`, so a translation that is
 *          already imported never has its JSON parsed into memory again.
 *
 *          WAL housekeeping runs last. A big import grows the write-ahead log to
 *          ~11 MB, and SQLite keeps that file at its largest size even after
 *          checkpointing. `journal_size_limit` (per connection, so set each open)
 *          caps what stays on disk after future checkpoints; the TRUNCATE
 *          checkpoint shrinks the existing file now. Nothing else is reading
 *          during init, so the checkpoint cannot be blocked.
 */
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  // Per-connection and not persisted in the file, so it must run on every open —
  // before anything writes. Without it, ON DELETE SET NULL on Notes.TopicId is
  // silently ignored and deleting a topic would orphan its verses.
  await db.execAsync('PRAGMA foreign_keys = ON');

  await migrateDbIfNeeded(db);
  await seedBibleIfNeeded(db);
  // After the canon seed: the names point at Books and Translations rows.
  await seedBookNames(db);

  for (const translation of BUNDLED_TRANSLATIONS) {
    // Already imported → skip without ever calling load(), so its JSON stays unparsed.
    if ((await countVerses(db, translation.code)) > 0) continue;
    await importTranslation(db, { code: translation.code, verses: translation.load() });
  }

  // Cap the WAL left on disk after checkpoints at 4 MB, and shrink it now.
  await db.execAsync('PRAGMA journal_size_limit = 4194304; PRAGMA wal_checkpoint(TRUNCATE);');
}
