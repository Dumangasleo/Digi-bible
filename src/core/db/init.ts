import { type SQLiteDatabase } from 'expo-sqlite';

import { migrateDbIfNeeded } from './migrations';
import { BUNDLED_TRANSLATIONS } from './seed/bundledTranslations';
import { importTranslation } from './seed/importVerses';
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

  // No-op until a translation is registered in bundledTranslations.ts.
  for (const payload of BUNDLED_TRANSLATIONS) {
    await importTranslation(db, payload);
  }
}
