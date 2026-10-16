import { type ImportVerse } from './importVerses';

/** A bundled translation whose verses are loaded only when actually needed. */
export interface BundledTranslation {
  /** Must match a `Translations.Code` seeded by `seedBibleIfNeeded`. */
  code: string;
  /** Loads the verse array. Call only when the translation is not imported yet. */
  load: () => ImportVerse[];
}

/**
 * Verse text that ships inside the app and is imported on first launch.
 *
 * @remarks **Lazy on purpose.** A top-level `import kjv from '…json'` makes Metro
 *          evaluate the file the moment this module loads — on *every* launch —
 *          turning ~17 MB of JSON into ~93,000 objects (about 21 MB of memory)
 *          even though the text has been in SQLite since the first launch.
 *
 *          A `require()` inside a function is different: Metro evaluates a module
 *          the first time it is required, so the JSON is parsed only if `load()`
 *          is called. `initializeDatabase` calls it only for a translation whose
 *          verse count is zero. After the first launch: no parse, no memory.
 *
 *          The files are still inside the app bundle; moving them out of it is
 *          a separate, native-build change (a prebuilt database asset).
 */
export const BUNDLED_TRANSLATIONS: BundledTranslation[] = [
  { code: 'KJV', load: () => require('@/assets/bible/kjv.verses.json') as ImportVerse[] },
  { code: 'ADB', load: () => require('@/assets/bible/adb.verses.json') as ImportVerse[] },
  { code: 'CEB', load: () => require('@/assets/bible/ceb.verses.json') as ImportVerse[] },
];
