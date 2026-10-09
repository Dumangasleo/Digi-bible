import { type SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_VERSION } from './config';

/**
 * Versioned schema migration, run once per launch via `SQLiteProvider.onInit`.
 *
 * Uses SQLite's built-in `PRAGMA user_version` as the version marker. Each
 * `if (version === N)` block upgrades the schema from N to N+1; append new
 * blocks over time and bump DATABASE_VERSION in `config.ts` — never edit a
 * shipped block, always add the next one.
 *
 * @param db - Open connection supplied by `SQLiteProvider`.
 * @returns Resolves once the schema is at DATABASE_VERSION. No-op when already current.
 * @throws {SQLiteError} If any DDL statement fails; startup should fail loudly
 *         rather than run against a half-built schema.
 * @remarks Every table, column, index and trigger name is PascalCase — the
 *          project-wide schema convention. SQLite is case-insensitive when
 *          *matching* identifiers but preserves the declared spelling, and
 *          `SELECT *` returns columns with that exact spelling. Row types in
 *          the feature slices therefore mirror these names character for
 *          character, which is what removes the need for a mapping layer.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version >= DATABASE_VERSION) return;

  // ── v0 → v1 : initial schema ────────────────────────────────────
  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      -- ===== Reference data (immutable, ships with the app) =====

      CREATE TABLE IF NOT EXISTS Translations (
        Id        INTEGER PRIMARY KEY AUTOINCREMENT,
        Code      TEXT NOT NULL UNIQUE,
        Name      TEXT NOT NULL,
        Language  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Books (
        Id              INTEGER PRIMARY KEY,
        OsisCode        TEXT NOT NULL UNIQUE,
        Testament       TEXT NOT NULL CHECK (Testament IN ('OT','NT')),
        CanonicalOrder  INTEGER NOT NULL UNIQUE,
        ChapterCount    INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS BookNames (
        BookId         INTEGER NOT NULL REFERENCES Books(Id) ON DELETE CASCADE,
        TranslationId  INTEGER NOT NULL REFERENCES Translations(Id) ON DELETE CASCADE,
        Name           TEXT NOT NULL,
        Abbreviation   TEXT,
        PRIMARY KEY (BookId, TranslationId)
      );

      CREATE TABLE IF NOT EXISTS Chapters (
        Id          INTEGER PRIMARY KEY AUTOINCREMENT,
        BookId      INTEGER NOT NULL REFERENCES Books(Id) ON DELETE CASCADE,
        Number      INTEGER NOT NULL,
        VerseCount  INTEGER NOT NULL,
        UNIQUE (BookId, Number)
      );

      CREATE TABLE IF NOT EXISTS Verses (
        Id             INTEGER PRIMARY KEY AUTOINCREMENT,
        TranslationId  INTEGER NOT NULL REFERENCES Translations(Id) ON DELETE CASCADE,
        BookId         INTEGER NOT NULL REFERENCES Books(Id) ON DELETE CASCADE,
        Chapter        INTEGER NOT NULL,
        Verse          INTEGER NOT NULL,
        Text           TEXT NOT NULL,
        -- This UNIQUE index is also the reader's hot-path covering index:
        -- "chapter X of book Y in translation Z" is a range scan on its
        -- leading columns, so no separate index is needed.
        UNIQUE (TranslationId, BookId, Chapter, Verse)
      );

      -- Full-text search across all translations. remove_diacritics 2 makes
      -- Tagalog/Cebuano searches accent-insensitive.
      -- External-content FTS: the index stores no copy of the text, it points
      -- back at Verses.Id, so the DB does not double in size.
      CREATE VIRTUAL TABLE IF NOT EXISTS VersesFts USING fts5(
        Text,
        content='Verses',
        content_rowid='Id',
        tokenize='unicode61 remove_diacritics 2'
      );

      CREATE TRIGGER IF NOT EXISTS VersesAfterInsert AFTER INSERT ON Verses BEGIN
        INSERT INTO VersesFts(rowid, Text) VALUES (new.Id, new.Text);
      END;
      CREATE TRIGGER IF NOT EXISTS VersesAfterDelete AFTER DELETE ON Verses BEGIN
        INSERT INTO VersesFts(VersesFts, rowid, Text) VALUES('delete', old.Id, old.Text);
      END;
      CREATE TRIGGER IF NOT EXISTS VersesAfterUpdate AFTER UPDATE ON Verses BEGIN
        INSERT INTO VersesFts(VersesFts, rowid, Text) VALUES('delete', old.Id, old.Text);
        INSERT INTO VersesFts(rowid, Text) VALUES (new.Id, new.Text);
      END;

      -- ===== User data (mutable, created & migrated on-device) =====

      CREATE TABLE IF NOT EXISTS Notes (
        Id             INTEGER PRIMARY KEY AUTOINCREMENT,
        BookId         INTEGER NOT NULL REFERENCES Books(Id),
        Chapter        INTEGER NOT NULL,
        VerseStart     INTEGER NOT NULL,
        VerseEnd       INTEGER,
        TranslationId  INTEGER REFERENCES Translations(Id),
        Title          TEXT,
        Body           TEXT NOT NULL,
        Summary        TEXT,
        Color          TEXT,
        IsPinned       INTEGER NOT NULL DEFAULT 0,
        CreatedAt      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UpdatedAt      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS IdxNotesRef     ON Notes (BookId, Chapter, VerseStart);
      CREATE INDEX IF NOT EXISTS IdxNotesCreated ON Notes (CreatedAt);

      CREATE TABLE IF NOT EXISTS ReadingHistory (
        Id             INTEGER PRIMARY KEY AUTOINCREMENT,
        BookId         INTEGER NOT NULL REFERENCES Books(Id),
        Chapter        INTEGER NOT NULL,
        Verse          INTEGER,
        TranslationId  INTEGER REFERENCES Translations(Id),
        ReadOn         TEXT NOT NULL,
        ReadAt         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS IdxHistoryDay ON ReadingHistory (ReadOn);
      CREATE INDEX IF NOT EXISTS IdxHistoryRef ON ReadingHistory (BookId, Chapter);

      CREATE TABLE IF NOT EXISTS Events (
        Id               INTEGER PRIMARY KEY AUTOINCREMENT,
        Title            TEXT NOT NULL,
        Description      TEXT,
        Location         TEXT,
        StartsAt         TEXT NOT NULL,
        EndsAt           TEXT,
        AllDay           INTEGER NOT NULL DEFAULT 0,
        ReminderMinutes  INTEGER,
        RecurrenceRule   TEXT,
        NotificationId   TEXT,
        CreatedAt        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UpdatedAt        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS IdxEventsStart ON Events (StartsAt);
    `);
    version = 1;
  }

    // v1 → v2 : study topics
  if (version === 1) {
    // Table, column, index AND version bump commit together or not at all. If the
    // app died after the ALTER but before the bump, the next launch would re-run
    // this block and fail forever on "duplicate column name: TopicId".
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS Topics (
          Id           INTEGER PRIMARY KEY AUTOINCREMENT,
          Title        TEXT NOT NULL,
          Description  TEXT,
          CreatedAt    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          UpdatedAt    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );

        -- NULL = "Walay Topic". Deleting a topic moves its verses back there
        -- instead of deleting them (D2 = SET NULL).
        ALTER TABLE Notes ADD COLUMN TopicId INTEGER REFERENCES Topics(Id) ON DELETE SET NULL;

        -- TopicId leads, so this serves every "verses of topic X" lookup, and
        -- UNIQUE forbids the same verse twice in one topic. NULLs are distinct
        -- in SQLite, so uncategorized notes are unaffected.
        CREATE UNIQUE INDEX IF NOT EXISTS IdxNotesTopicVerse
          ON Notes (TopicId, BookId, Chapter, VerseStart);

        PRAGMA user_version = 2;
      `);
    });
    version = 2;
  }

  // ── v2 → v3 : description blocks + verse highlights ─────────────
  if (version === 2) {
    // Same rule as v2: both tables and the version bump commit together.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        -- Free-text explanation blocks inside a topic, interleaved with its verses.
        -- CASCADE: a description has no meaning without its topic, unlike a verse
        -- (which moves to "Walay Topic" instead).
        CREATE TABLE IF NOT EXISTS TopicTexts (
          Id         INTEGER PRIMARY KEY AUTOINCREMENT,
          TopicId    INTEGER NOT NULL REFERENCES Topics(Id) ON DELETE CASCADE,
          Body       TEXT NOT NULL,
          CreatedAt  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          UpdatedAt  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE INDEX IF NOT EXISTS IdxTopicTextsTopic ON TopicTexts (TopicId, CreatedAt);

        -- Highlighted words of one filed verse, per translation: word #5 in the
        -- English text is a different word from #5 in Bisaya, so one row each.
        -- WordIndexes is a JSON array of 0-based word positions, e.g. '[2,3,4]'.
        CREATE TABLE IF NOT EXISTS NoteHighlights (
          NoteId         INTEGER NOT NULL REFERENCES Notes(Id) ON DELETE CASCADE,
          TranslationId  INTEGER NOT NULL REFERENCES Translations(Id) ON DELETE CASCADE,
          WordIndexes    TEXT NOT NULL,
          PRIMARY KEY (NoteId, TranslationId)
        );

        PRAGMA user_version = 3;
      `);
    });
    version = 3;
  }


  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
