/** Public surface of the database module. */
export { DATABASE_NAME, DATABASE_VERSION } from './config';
export { initializeDatabase } from './init';
export { migrateDbIfNeeded } from './migrations';
export { seedBibleIfNeeded } from './seed/seedBible';
export { seedBookNames } from './seed/seedBookNames';
export { BUNDLED_TRANSLATIONS } from './seed/bundledTranslations';
export {
  countVerses,
  importTranslation,
  rebuildSearchIndex,
  type ImportBookName,
  type ImportVerse,
  type TranslationPayload,
} from './seed/importVerses';
