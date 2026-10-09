/** A persisted church event, mirroring the `Events` table. */
export interface ChurchEvent {
  Id: number;
  Title: string;
  Description: string | null;
  Location: string | null;
  /** ISO-8601 start instant. */
  StartsAt: string;
  EndsAt: string | null;
  /** SQLite has no boolean; 0 | 1. */
  AllDay: number;
  ReminderMinutes: number | null;
  RecurrenceRule: string | null;
  /** expo-notifications identifier for the scheduled reminder, if any. */
  NotificationId: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

/** App-level input for creating an event. camelCase — this is a DTO, not a row. */
export interface NewEvent {
  title: string;
  description?: string | null;
  location?: string | null;
  /** ISO-8601 start instant. */
  startsAt: string;
  endsAt?: string | null;
  allDay?: boolean;
  /** Minutes before start to fire a reminder. Omit for no reminder. */
  reminderMinutes?: number | null;
}
