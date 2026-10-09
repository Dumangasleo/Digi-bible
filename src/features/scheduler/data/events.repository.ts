import { type SQLiteDatabase } from 'expo-sqlite';

import { type ChurchEvent, type NewEvent } from '../types';

/** Pure data access for church events. Notification scheduling lives in the service. */
export const eventsRepository = {
  /**
   * Inserts an event.
   *
   * @param db - Open connection.
   * @param e - Validated event input.
   * @param notificationId - The OS notification id, or `null` when no reminder
   *                         was scheduled. Passed in rather than looked up so
   *                         this layer stays free of `expo-notifications`.
   * @returns The new `Events.Id`.
   */
  async create(
    db: SQLiteDatabase,
    e: NewEvent,
    notificationId: string | null,
  ): Promise<number> {
    const result = await db.runAsync(
      `INSERT INTO Events
         (Title, Description, Location, StartsAt, EndsAt, AllDay, ReminderMinutes, NotificationId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.title,
        e.description ?? null,
        e.location ?? null,
        e.startsAt,
        e.endsAt ?? null,
        e.allDay ? 1 : 0,
        e.reminderMinutes ?? null,
        notificationId,
      ],
    );
    return result.lastInsertRowId;
  },

  /**
   * @param db - Open connection.
   * @param id - `Events.Id`.
   * @returns The event, or `null` if already deleted.
   */
  getById(db: SQLiteDatabase, id: number): Promise<ChurchEvent | null> {
    return db.getFirstAsync<ChurchEvent>('SELECT * FROM Events WHERE Id = ?', [id]);
  },

  /**
   * Events starting at or after an instant.
   *
   * @param db - Open connection.
   * @param fromIso - ISO-8601 lower bound, usually "now".
   * @returns Soonest first. Empty when nothing is scheduled ahead.
   * @remarks String comparison on an ISO-8601 column is a correct chronological
   *          comparison because the format is fixed-width and big-endian — which
   *          is exactly why `StartsAt` is stored as TEXT rather than as an epoch
   *          number. `IdxEventsStart` turns this into an index range scan.
   */
  listUpcoming(db: SQLiteDatabase, fromIso: string): Promise<ChurchEvent[]> {
    return db.getAllAsync<ChurchEvent>(
      'SELECT * FROM Events WHERE StartsAt >= ? ORDER BY StartsAt ASC',
      [fromIso],
    );
  },

  /**
   * @param db - Open connection.
   * @returns Every event, soonest first, past ones included.
   */
  listAll(db: SQLiteDatabase): Promise<ChurchEvent[]> {
    return db.getAllAsync<ChurchEvent>('SELECT * FROM Events ORDER BY StartsAt ASC');
  },

  /**
   * Links (or unlinks) an event to its scheduled OS notification.
   *
   * @param db - Open connection.
   * @param id - `Events.Id`.
   * @param notificationId - The id to store, or `null` to clear it.
   * @returns Resolves when written.
   */
  async setNotificationId(
    db: SQLiteDatabase,
    id: number,
    notificationId: string | null,
  ): Promise<void> {
    await db.runAsync('UPDATE Events SET NotificationId = ? WHERE Id = ?', [
      notificationId,
      id,
    ]);
  },

  /**
   * Hard-deletes an event row. Cancelling its notification is the service's job.
   *
   * @param db - Open connection.
   * @param id - `Events.Id`.
   * @returns Resolves even when the id no longer exists.
   */
  async remove(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM Events WHERE Id = ?', [id]);
  },
};
