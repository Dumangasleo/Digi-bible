/**
 * A persisted note, exactly as stored. PascalCase because it mirrors the
 * `Notes` table — see the note on naming in `bible-reader/types.ts`.
 */
export interface Note {
  Id: number;
  BookId: number;
  Chapter: number;
  VerseStart: number;
  VerseEnd: number | null;
  TranslationId: number | null;
  Title: string | null;
  Body: string;
  /** Reserved for LLM-generated summaries (see core/ai). */
  Summary: string | null;
  Color: string | null;
  /** SQLite has no boolean; 0 | 1. */
  IsPinned: number;
  /** Owning topid or null for the (No topic Group). */
  TopicId: number | null;
  CreatedAt: string;
  UpdatedAt: string;
}

/**
 * Input for creating a note. camelCase: this is an app-level DTO, not a row —
 * the repository is what knows which column each field lands in.
 */
export interface NewNote {
  bookId: number;
  chapter: number;
  verseStart: number;
  verseEnd?: number | null;
  translationId?: number | null;
  title?: string | null;
  body: string;
  color?: string | null;
  topicId?: number | null;
}

/**
 * Partial update. Every field is optional and `undefined` means "leave alone",
 * which is distinct from `null` meaning "clear this column".
 */
export interface NotePatch {
  title?: string | null;
  body?: string;
  color?: string | null;
  summary?: string | null;
  isPinned?: boolean;
}


// ── Topics ───────────────────────────────────────────────────────

/** A study topic, mirroring the `Topics` table. */
export interface Topic {
  Id: number;
  Title: string;
  Description: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

/**
 * One card in the topics list: the topic plus its verse count and the first
 * verse added (shown under the title). A query result, not a table.
 */
export interface TopicSummary extends Topic {
  VerseCount: number;
  /** Null only if every verse was removed from the topic. */
  FirstBookId: number | null;
  FirstChapter: number | null;
  FirstVerse: number | null;
}

/** One verse inside a topic: the Notes row joined with its verse text. */
export interface TopicVerse {
  NoteId: number;
  BookId: number;
  Chapter: number;
  VerseStart: number;
  VerseEnd: number | null;
  /** Legacy per-note title; null for verses added through topics. */
  Title: string | null;
  /** '' when the verse was added without a personal note (D3). */
  Body: string;
  CreatedAt: string;
  /** Verse text in the requested translation; null if that text is not imported. */
  Text: string | null;
  /**
   * Highlighted word positions (0-based) in `Text`, for the requested translation
   * only. Empty when nothing is highlighted in that language.
   */
  Highlights: number[];
}

/**
 * `TopicVerse` as SQLite returns it: highlights still a JSON string. The service
 * parses it, so the UI only ever sees `number[]`.
 */
export type TopicVerseRow = Omit<TopicVerse, 'Highlights'> & { HighlightsJson: string | null };

/** A free-text explanation block inside a topic, mirroring `TopicTexts`. */
export interface TopicText {
  Id: number;
  TopicId: number;
  Body: string;
  CreatedAt: string;
  UpdatedAt: string;
}

/**
 * One entry on the topic page, in the order it was added: either a verse or a
 * description block. A tagged union, so the screen must handle both kinds.
 */
export type TopicItem =
  | { kind: 'verse'; key: string; createdAt: string; verse: TopicVerse }
  | { kind: 'text'; key: string; createdAt: string; text: TopicText };

/** Partial update of a topic's own fields. */
export interface TopicPatch {
  title: string;
  description?: string | null;
}

/** A verse reference. App-level, so camelCase. */
export interface VerseRef {
  bookId: number;
  chapter: number;
  verse: number;
}

/** Input for creating a topic. Every topic is born with one verse. */
export interface NewTopic {
  title: string;
  description?: string | null;
  firstVerse: VerseRef;
  translationId?: number | null;
  /** Words of the first verse highlighted before saving (in `translationId`). */
  firstHighlights?: number[];
}

/** Input for adding a verse to an existing topic. */
export interface NewTopicVerse extends VerseRef {
  topicId: number;
  translationId?: number | null;
  /** Optional personal note on this verse. */
  body?: string | null;
  /** Words highlighted before adding (in `translationId`). */
  highlights?: number[];
}

/** Everything the topics list screen needs in one load. */
export interface TopicList {
  topics: TopicSummary[];
  /** Notes with no topic — rendered as the "Walay Topic" group (D1). */
  uncategorizedCount: number;
}

/** Everything the topic detail screen needs in one load. */
export interface TopicDetail {
  /** Null for the "No Topic" group, or if the topic was deleted. */
  topic: Topic | null;
  verses: TopicVerse[];
  /** Verses and description blocks merged in the order they were added. */
  items: TopicItem[];
}
