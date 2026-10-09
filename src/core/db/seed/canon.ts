/**
 * Canonical 66-book Protestant canon with standard KJV chapter counts,
 * language-neutral OSIS codes, and English display names.
 *
 * `id` doubles as the canonical order (1..66). Localized book names for
 * Tagalog (ADB) and Bisaya (CEB) are added by the Phase 2 verse pipeline;
 * until then the reader falls back to these English names.
 */
export interface CanonBook {
  /** Canonical order, 1..66. Used as the stable primary key for `books`. */
  id: number;
  /** Language-neutral OSIS identifier, e.g. 'Gen', '1Cor'. */
  osis: string;
  testament: 'OT' | 'NT';
  /** Number of chapters (KJV versification). */
  chapters: number;
  /** English (KJV) display name. */
  name: string;
}

export const CANON: readonly CanonBook[] = [
  // ── Old Testament ──────────────────────────────────────────────
  { id: 1, osis: 'Gen', testament: 'OT', chapters: 50, name: 'Genesis' },
  { id: 2, osis: 'Exod', testament: 'OT', chapters: 40, name: 'Exodus' },
  { id: 3, osis: 'Lev', testament: 'OT', chapters: 27, name: 'Leviticus' },
  { id: 4, osis: 'Num', testament: 'OT', chapters: 36, name: 'Numbers' },
  { id: 5, osis: 'Deut', testament: 'OT', chapters: 34, name: 'Deuteronomy' },
  { id: 6, osis: 'Josh', testament: 'OT', chapters: 24, name: 'Joshua' },
  { id: 7, osis: 'Judg', testament: 'OT', chapters: 21, name: 'Judges' },
  { id: 8, osis: 'Ruth', testament: 'OT', chapters: 4, name: 'Ruth' },
  { id: 9, osis: '1Sam', testament: 'OT', chapters: 31, name: '1 Samuel' },
  { id: 10, osis: '2Sam', testament: 'OT', chapters: 24, name: '2 Samuel' },
  { id: 11, osis: '1Kgs', testament: 'OT', chapters: 22, name: '1 Kings' },
  { id: 12, osis: '2Kgs', testament: 'OT', chapters: 25, name: '2 Kings' },
  { id: 13, osis: '1Chr', testament: 'OT', chapters: 29, name: '1 Chronicles' },
  { id: 14, osis: '2Chr', testament: 'OT', chapters: 36, name: '2 Chronicles' },
  { id: 15, osis: 'Ezra', testament: 'OT', chapters: 10, name: 'Ezra' },
  { id: 16, osis: 'Neh', testament: 'OT', chapters: 13, name: 'Nehemiah' },
  { id: 17, osis: 'Esth', testament: 'OT', chapters: 10, name: 'Esther' },
  { id: 18, osis: 'Job', testament: 'OT', chapters: 42, name: 'Job' },
  { id: 19, osis: 'Ps', testament: 'OT', chapters: 150, name: 'Psalms' },
  { id: 20, osis: 'Prov', testament: 'OT', chapters: 31, name: 'Proverbs' },
  { id: 21, osis: 'Eccl', testament: 'OT', chapters: 12, name: 'Ecclesiastes' },
  { id: 22, osis: 'Song', testament: 'OT', chapters: 8, name: 'Song of Solomon' },
  { id: 23, osis: 'Isa', testament: 'OT', chapters: 66, name: 'Isaiah' },
  { id: 24, osis: 'Jer', testament: 'OT', chapters: 52, name: 'Jeremiah' },
  { id: 25, osis: 'Lam', testament: 'OT', chapters: 5, name: 'Lamentations' },
  { id: 26, osis: 'Ezek', testament: 'OT', chapters: 48, name: 'Ezekiel' },
  { id: 27, osis: 'Dan', testament: 'OT', chapters: 12, name: 'Daniel' },
  { id: 28, osis: 'Hos', testament: 'OT', chapters: 14, name: 'Hosea' },
  { id: 29, osis: 'Joel', testament: 'OT', chapters: 3, name: 'Joel' },
  { id: 30, osis: 'Amos', testament: 'OT', chapters: 9, name: 'Amos' },
  { id: 31, osis: 'Obad', testament: 'OT', chapters: 1, name: 'Obadiah' },
  { id: 32, osis: 'Jonah', testament: 'OT', chapters: 4, name: 'Jonah' },
  { id: 33, osis: 'Mic', testament: 'OT', chapters: 7, name: 'Micah' },
  { id: 34, osis: 'Nah', testament: 'OT', chapters: 3, name: 'Nahum' },
  { id: 35, osis: 'Hab', testament: 'OT', chapters: 3, name: 'Habakkuk' },
  { id: 36, osis: 'Zeph', testament: 'OT', chapters: 3, name: 'Zephaniah' },
  { id: 37, osis: 'Hag', testament: 'OT', chapters: 2, name: 'Haggai' },
  { id: 38, osis: 'Zech', testament: 'OT', chapters: 14, name: 'Zechariah' },
  { id: 39, osis: 'Mal', testament: 'OT', chapters: 4, name: 'Malachi' },
  // ── New Testament ──────────────────────────────────────────────
  { id: 40, osis: 'Matt', testament: 'NT', chapters: 28, name: 'Matthew' },
  { id: 41, osis: 'Mark', testament: 'NT', chapters: 16, name: 'Mark' },
  { id: 42, osis: 'Luke', testament: 'NT', chapters: 24, name: 'Luke' },
  { id: 43, osis: 'John', testament: 'NT', chapters: 21, name: 'John' },
  { id: 44, osis: 'Acts', testament: 'NT', chapters: 28, name: 'Acts' },
  { id: 45, osis: 'Rom', testament: 'NT', chapters: 16, name: 'Romans' },
  { id: 46, osis: '1Cor', testament: 'NT', chapters: 16, name: '1 Corinthians' },
  { id: 47, osis: '2Cor', testament: 'NT', chapters: 13, name: '2 Corinthians' },
  { id: 48, osis: 'Gal', testament: 'NT', chapters: 6, name: 'Galatians' },
  { id: 49, osis: 'Eph', testament: 'NT', chapters: 6, name: 'Ephesians' },
  { id: 50, osis: 'Phil', testament: 'NT', chapters: 4, name: 'Philippians' },
  { id: 51, osis: 'Col', testament: 'NT', chapters: 4, name: 'Colossians' },
  { id: 52, osis: '1Thess', testament: 'NT', chapters: 5, name: '1 Thessalonians' },
  { id: 53, osis: '2Thess', testament: 'NT', chapters: 3, name: '2 Thessalonians' },
  { id: 54, osis: '1Tim', testament: 'NT', chapters: 6, name: '1 Timothy' },
  { id: 55, osis: '2Tim', testament: 'NT', chapters: 4, name: '2 Timothy' },
  { id: 56, osis: 'Titus', testament: 'NT', chapters: 3, name: 'Titus' },
  { id: 57, osis: 'Phlm', testament: 'NT', chapters: 1, name: 'Philemon' },
  { id: 58, osis: 'Heb', testament: 'NT', chapters: 13, name: 'Hebrews' },
  { id: 59, osis: 'Jas', testament: 'NT', chapters: 5, name: 'James' },
  { id: 60, osis: '1Pet', testament: 'NT', chapters: 5, name: '1 Peter' },
  { id: 61, osis: '2Pet', testament: 'NT', chapters: 3, name: '2 Peter' },
  { id: 62, osis: '1John', testament: 'NT', chapters: 5, name: '1 John' },
  { id: 63, osis: '2John', testament: 'NT', chapters: 1, name: '2 John' },
  { id: 64, osis: '3John', testament: 'NT', chapters: 1, name: '3 John' },
  { id: 65, osis: 'Jude', testament: 'NT', chapters: 1, name: 'Jude' },
  { id: 66, osis: 'Rev', testament: 'NT', chapters: 22, name: 'Revelation' },
];
