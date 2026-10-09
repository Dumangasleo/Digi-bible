/**
 * Row shapes for the reader.
 *
 * @remarks These mirror the SQLite schema **character for character**, in
 *          PascalCase. `SELECT *` hands back columns with their declared
 *          spelling, so matching the schema here is what lets a query result
 *          be used directly as a typed row with no mapping layer in between.
 *          The rule across the codebase: *row* types are PascalCase (they are
 *          the schema), *input* DTOs are camelCase (they are app-level).
 */
export interface Translation {
  Id: number;
  Code: string;
  Name: string;
  Language: string;
}

export interface Book {
  Id: number;
  OsisCode: string;
  Testament: 'OT' | 'NT';
  CanonicalOrder: number;
  ChapterCount: number;
  /** Localized display name (falls back to English when unavailable). */
  Name: string;
}

export interface Verse {
  Id: number;
  TranslationId: number;
  BookId: number;
  Chapter: number;
  Verse: number;
  Text: string;
}

/**
 * A search result: the verse row plus the code of the translation it matched in
 * ('KJV' | 'ADB' | 'CEB'). A query result shape, not a table.
 */
export interface SearchHit extends Verse {
  TranslationCode: string;
}
