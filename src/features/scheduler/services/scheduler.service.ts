import { subMinutes } from 'date-fns';
import { type SQLiteDatabase } from 'expo-sqlite';

import { notificationsService } from '@/core/notifications';

import { eventsRepository } from '../data/events.repository';
import { type ChurchEvent, type NewEvent } from '../types';

/**
 * Orchestrates church events + their reminders. This is the seam where the
 * DB (Events table) and the device (expo-notifications) are coordinated, so
 * a row and its OS notification never drift out of sync.
 */
export const schedulerService = {
  /**
   * Creates an event and, if asked for, schedules its reminder.
   *
   * @param db - Open connection.
   * @param input - The event to create.
   * @returns The new event's id.
   * @throws {Error} If the title is blank.
   * @remarks **Ordering is deliberate.** The row is written first with a `null`
   *          NotificationId, then the OS notification is scheduled, then the id
   *          is written back. The alternative — schedule first, then insert —
   *          can orphan a notification that fires for an event that was never
   *          saved. This ordering's failure mode is the benign one: an event
   *          with no reminder, which the user can see and fix.
   *
   *          A reminder already in the past is skipped rather than fired
   *          immediately, and a denied permission degrades to "event without
   *          reminder" rather than failing the create.
   */
  async createEvent(db: SQLiteDatabase, input: NewEvent): Promise<number> {
    if (!input.title.trim()) {
      throw new Error('Event title is required.');
    }
    const id = await eventsRepository.create(db, input, null);

    if (input.reminderMinutes != null) {
      const fireDate = subMinutes(new Date(input.startsAt), input.reminderMinutes);
      if (fireDate.getTime() > Date.now()) {
        const granted = await notificationsService.requestPermissions();
        if (granted) {
          const notificationId = await notificationsService.scheduleAt(fireDate, {
            title: input.title,
            body: input.location ?? 'Upcoming church event',
            data: { eventId: id },
          });
          await eventsRepository.setNotificationId(db, id, notificationId);
        }
      }
    }
    return id;
  },

  listUpcoming: (db: SQLiteDatabase, fromIso: string): Promise<ChurchEvent[]> =>
    eventsRepository.listUpcoming(db, fromIso),

  listAll: (db: SQLiteDatabase): Promise<ChurchEvent[]> => eventsRepository.listAll(db),

  /**
   * Deletes an event and cancels any reminder it owns.
   *
   * @param db - Open connection.
   * @param id - `Events.Id`.
   * @returns Resolves when both the row and the notification are gone.
   * @remarks Cancel-then-delete. The reverse order can leave a notification
   *          firing for a row that no longer exists — a reminder the user cannot
   *          get rid of because the UI that owns it is gone.
   */
  async deleteEvent(db: SQLiteDatabase, id: number): Promise<void> {
    const event = await eventsRepository.getById(db, id);
    if (event?.NotificationId) {
      await notificationsService.cancel(event.NotificationId);
    }
    await eventsRepository.remove(db, id);
  },
};
