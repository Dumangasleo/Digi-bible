/**
 * One-off converter: scrollmapper Bible JSON → SmartBible's `ImportVerse[]` shape.
 *
 * Run from the project root:
 *
 *     node scripts/convert-bible.mjs
 *
 * Reads the nested source files in `assets/bible/`, flattens them, maps each
 * book to its canonical id from `canon.ts`, validates the result, and writes
 * one flat array per translation.
 *
 * Why this is a build-time script and not app code: the conversion is
 * deterministic and happens once. Doing it at runtime would make every user pay
 * CPU on first launch for work that can be done here, once, and committed.
 *
 * Why it validates so aggressively: a Bible import that is *wrong* looks exactly
 * like a Bible import that is *right* — the app starts, the reader scrolls, and
 * nobody notices that 1 John is filed under Jude until someone reads it. Every
 * check below exists to turn a silent data error into a loud crash.
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Project root, resolved from this file so the script works from any cwd. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIBLE_DIR = join(ROOT, 'assets', 'bible');
const CANON_PATH = join(ROOT, 'src', 'core', 'db', 'seed', 'canon.ts');

/** Verse total for the KJV versification every shipped translation follows. */
const EXPECTED_VERSES = 31102;
const EXPECTED_BOOKS = 66;

/**
 * Source files to convert, mapped to the translation codes seeded in
 * `seedBible.ts`. The codes must match exactly — `importTranslation` throws on
 * an unknown code rather than inventing a translation row.
 */
const SOURCES = [
  { file: 'KJV.json', code: 'KJV', out: 'kjv.verses.json' },
  { file: 'TagAngBiblia.json', code: 'ADB', out: 'adb.verses.json' },
  { file: 'CebPinadayag.json', code: 'CEB', out: 'ceb.verses.json' },
];

/** Roman-numeral prefixes used by the source, mapped to canon's arabic ones. */
const ROMAN_PREFIX = { I: '1', II: '2', III: '3' };

/**
 * Rewrites a source book name into the spelling `canon.ts` uses.
 *
 * @param {string} name - Book name exactly as it appears in the source JSON.
 * @returns {string} The canonical spelling. Returns `name` unchanged for the 48
 *          books that already match, so this is safe to call on every book.
 * @remarks The source writes `I Samuel` / `II Kings` / `III John` where canon
 *          writes `1 Samuel` / `2 Kings` / `3 John`, and calls the last book
 *          `Revelation of John`. That is 18 books out of 66 — every one of which
 *          would silently fail an exact-name lookup.
 *
 *          The regex is anchored (`^`) and requires the trailing space so it can
 *          only ever touch a numeral *prefix*. Without the anchor, `Isaiah`
 *          would match the `I` alternative and become `1saiah`. The alternation
 *          is ordered longest-first (`III|II|I`) because regex alternation is
 *          first-match, not longest-match: with `I|II|III`, the string
 *          `III John` would match just `I` and produce `1I John`.
 */
function toCanonName(name) {
  if (name === 'Revelation of John') return 'Revelation';
  return name.replace(/^(III|II|I) /, (_, numeral) => `${ROMAN_PREFIX[numeral]} `);
}

/**
 * Parses `canon.ts` into a lookup of canonical book name → id.
 *
 * @returns {{ byName: Map<string, number>, chaptersById: Map<number, number> }}
 * @throws {Error} If the parse does not yield exactly 66 books with ids 1..66.
 * @remarks Reads the TypeScript source with a regex rather than importing it,
 *          because Node 20 cannot import a `.ts` module without a loader, and
 *          adding `tsx`/`esbuild` for a one-off script is not worth a new
 *          dependency. Hardcoding the 66 names here was the other option and is
 *          worse: it creates a second source of truth that can drift from
 *          `canon.ts` without anyone noticing.
 *
 *          The brittleness of regex-parsing is contained by the assertions
 *          below. If `canon.ts` is ever reformatted such that the parse breaks,
 *          this throws immediately — it cannot quietly emit a partial map and
 *          drop books.
 *
 *          Each object literal is matched first and its fields extracted
 *          individually, so field *order* and whitespace inside the literal do
 *          not matter.
 */
function loadCanon() {
  const source = readFileSync(CANON_PATH, 'utf8');
  const literals = source.match(/\{[^{}]*\bid:\s*\d+[^{}]*\}/g) ?? [];

  const byName = new Map();
  const chaptersById = new Map();

  for (const literal of literals) {
    const id = Number(/\bid:\s*(\d+)/.exec(literal)?.[1]);
    const chapters = Number(/\bchapters:\s*(\d+)/.exec(literal)?.[1]);
    const name = /\bname:\s*'([^']+)'/.exec(literal)?.[1];

    if (!Number.isInteger(id) || !Number.isInteger(chapters) || !name) continue;
    byName.set(name, id);
    chaptersById.set(id, chapters);
  }

  if (byName.size !== EXPECTED_BOOKS) {
    throw new Error(
      `canon.ts parse produced ${byName.size} books, expected ${EXPECTED_BOOKS}. ` +
        `The CANON array format probably changed — fix the regex in loadCanon().`,
    );
  }

  const ids = [...chaptersById.keys()].sort((a, b) => a - b);
  if (ids[0] !== 1 || ids[ids.length - 1] !== EXPECTED_BOOKS) {
    throw new Error(`canon.ts ids are not 1..${EXPECTED_BOOKS}: got ${ids[0]}..${ids[ids.length - 1]}`);
  }

  return { byName, chaptersById };
}

/**
 * Flattens one source file into `ImportVerse[]` and reports anything suspicious.
 *
 * @param {{ file: string, code: string, out: string }} source - Source descriptor.
 * @param {Map<string, number>} byName - Canonical name → book id.
 * @param {Map<number, number>} chaptersById - Book id → expected chapter count.
 * @returns {{ verses: Array<{book: number, chapter: number, verse: number, text: string}>, warnings: string[] }}
 * @throws {Error} If a book name cannot be resolved, if the book count is wrong,
 *         or if any book ends up with zero verses.
 * @remarks **Unresolved names are fatal, on purpose.** The tempting alternative
 *          is to skip them with a warning, which is how you end up shipping a
 *          Bible that is missing 18 books. If a name does not resolve, the
 *          mapping assumption is broken and the whole output is untrustworthy.
 *
 *          Chapter-count drift is only a warning, because a legitimately
 *          different edition can differ there, and a short book is still
 *          readable. A *missing* book is not.
 */
function flatten(source, byName, chaptersById) {
  const raw = JSON.parse(readFileSync(join(BIBLE_DIR, source.file), 'utf8'));
  const books = raw.books ?? [];
  const warnings = [];

  if (books.length !== EXPECTED_BOOKS) {
    throw new Error(`${source.file}: ${books.length} books, expected ${EXPECTED_BOOKS}`);
  }

  const verses = [];
  let markupHits = 0;

  for (const book of books) {
    const canonName = toCanonName(book.name);
    const bookId = byName.get(canonName);

    if (bookId === undefined) {
      throw new Error(
        `${source.file}: book "${book.name}" (normalized: "${canonName}") ` +
          `does not match any name in canon.ts. Add a rule to toCanonName().`,
      );
    }

    const chapters = book.chapters ?? [];
    const expectedChapters = chaptersById.get(bookId);
    if (chapters.length !== expectedChapters) {
      warnings.push(
        `${canonName}: ${chapters.length} chapters, canon expects ${expectedChapters}`,
      );
    }

    let bookVerses = 0;
    for (const chapter of chapters) {
      for (const verse of chapter.verses ?? []) {
        const text = String(verse.text ?? '').trim();
        if (!text) continue;

        // Strong's numbers / markup would arrive as {H1234} or <w> tags. The
        // sample text is clean, but count rather than assume — a silently
        // marked-up Bible reads badly and is hard to notice in a spot check.
        if (/[{<[]/.test(text)) markupHits++;

        verses.push({
          book: bookId,
          chapter: Number(chapter.chapter),
          verse: Number(verse.verse),
          text,
        });
        bookVerses++;
      }
    }

    if (bookVerses === 0) {
      throw new Error(`${source.file}: book "${canonName}" produced zero verses`);
    }
  }

  if (markupHits > 0) {
    warnings.push(`${markupHits} verses contain { < or [ — check for Strong's markup`);
  }
  if (verses.length !== EXPECTED_VERSES) {
    warnings.push(`${verses.length} verses, expected ${EXPECTED_VERSES} for KJV versification`);
  }

  const distinctBooks = new Set(verses.map((v) => v.book)).size;
  if (distinctBooks !== EXPECTED_BOOKS) {
    throw new Error(`${source.file}: verses span ${distinctBooks} books, expected ${EXPECTED_BOOKS}`);
  }

  return { verses, warnings };
}

/**
 * Spot-checks a well-known reference so a wrong mapping is caught by eye.
 *
 * @param {Array<{book: number, chapter: number, verse: number, text: string}>} verses
 * @returns {string} A one-line preview of John 3:16, truncated.
 * @remarks Book 43 chapter 3 verse 16 is John 3:16 under canonical numbering. If
 *          the name mapping were off by even one book, this would print
 *          something from Luke or Acts — obvious at a glance in any language,
 *          which is the point. Counts prove completeness; this proves alignment.
 */
function spotCheck(verses) {
  const hit = verses.find((v) => v.book === 43 && v.chapter === 3 && v.verse === 16);
  if (!hit) return 'John 3:16 NOT FOUND — mapping is wrong';
  return hit.text.length > 90 ? `${hit.text.slice(0, 90)}…` : hit.text;
}

/** Formats a byte count as MB with one decimal. */
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Converts every configured source and writes the flattened output.
 *
 * @returns {void}
 * @throws {Error} Propagates any validation failure; the process exits non-zero
 *         so a broken conversion can never be mistaken for a successful one.
 */
function main() {
  const { byName, chaptersById } = loadCanon();
  console.log(`canon.ts: ${byName.size} books loaded\n`);

  for (const source of SOURCES) {
    const { verses, warnings } = flatten(source, byName, chaptersById);

    const outPath = join(BIBLE_DIR, source.out);
    // Minified on purpose: pretty-printing this adds megabytes to the app
    // bundle for whitespace nobody will ever read.
    writeFileSync(outPath, JSON.stringify(verses), 'utf8');

    const inSize = statSync(join(BIBLE_DIR, source.file)).size;
    const outSize = statSync(outPath).size;

    console.log(`${source.code}  (${source.file})`);
    console.log(`  verses   : ${verses.length}`);
    console.log(`  size     : ${mb(inSize)} -> ${mb(outSize)}  (${source.out})`);
    console.log(`  John 3:16: ${spotCheck(verses)}`);
    for (const warning of warnings) console.log(`  WARN     : ${warning}`);
    console.log();
  }

  console.log('Done. Register the output in src/core/db/seed/bundledTranslations.ts.');
}

main();
