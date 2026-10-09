/**
 * Formats a human-readable verse reference:
 *   formatReference('John', 3, 16)        -> 'John 3:16'
 *   formatReference('John', 3, 16, 18)    -> 'John 3:16-18'
 */
export function formatReference(
  bookName: string,
  chapter: number,
  verseStart: number,
  verseEnd?: number | null,
): string {
  const base = `${bookName} ${chapter}:${verseStart}`;
  return verseEnd && verseEnd > verseStart ? `${base}-${verseEnd}` : base;
}
