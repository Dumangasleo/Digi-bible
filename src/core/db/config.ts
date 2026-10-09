/**
 * Central database configuration.
 *
 * Bump DATABASE_VERSION whenever you add a new migration step in
 * `migrations.ts`. The value stored in SQLite's `PRAGMA user_version`
 * is compared against this on every launch.
 *
 * @remarks The filename is deliberately PascalCase and deliberately *new*.
 *          The v1 schema was rewritten from snake_case to PascalCase before
 *          any release, so rather than shipping a table-rename migration for
 *          a schema nobody has, we point at a fresh file. Any stale
 *          `smartbible.db` left on a dev device is simply ignored — it can be
 *          deleted by reinstalling the app.
 */
export const DATABASE_NAME = 'SmartBible.db';
export const DATABASE_VERSION = 3;
