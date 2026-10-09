/** One recorded reading, mirroring the `ReadingHistory` table. */
export interface ReadingEntry {
  Id: number;
  BookId: number;
  Chapter: number;
  Verse: number | null;
  TranslationId: number | null;
  /** Local calendar day 'YYYY-MM-DD'. */
  ReadOn: string;
  /** ISO-8601 UTC instant. */
  ReadAt: string;
}

/** App-level input for recording a reading. camelCase — a DTO, not a row. */
export interface NewReadingEntry {
  bookId: number;
  chapter: number;
  verse?: number | null;
  translationId?: number | null;
  /** Override the local day; defaults to today. */
  readOn?: string;
}

/** Aggregate row: how many readings happened on one calendar day. */
export interface DayActivity {
  ReadOn: string;
  Count: number;
}
