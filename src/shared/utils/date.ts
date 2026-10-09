/** Current instant as ISO-8601 UTC — matches the format stored in the DB. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Local calendar day as 'YYYY-MM-DD'. Used to group reading history so the
 * calendar reflects the user's actual day, not UTC.
 */
export function toLocalDay(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local month as 'YYYY-MM', for querying a month of calendar activity. */
export function toLocalMonth(date: Date = new Date()): string {
  return toLocalDay(date).slice(0, 7);
}
