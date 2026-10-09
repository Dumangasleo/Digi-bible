import * as Notifications from 'expo-notifications';

export interface NotificationContent {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

/**
 * Framework-agnostic wrapper over expo-notifications. Feature services call
 * this instead of importing expo-notifications directly, so the dependency
 * stays quarantined in `core/`.
 */
export const notificationsService = {
  /** Ensures permission, prompting once if needed. Returns whether granted. */
  async requestPermissions(): Promise<boolean> {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return requested.granted;
  },

  /** Schedules a one-off local notification at an absolute date; returns its id. */
  async scheduleAt(date: Date, content: NotificationContent): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        data: content.data,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    });
  },

  cancel(notificationId: string): Promise<void> {
    return Notifications.cancelScheduledNotificationAsync(notificationId);
  },

  cancelAll(): Promise<void> {
    return Notifications.cancelAllScheduledNotificationsAsync();
  },
};
