import * as Notifications from 'expo-notifications';

/**
 * Controls how notifications render while the app is foregrounded. Call once
 * at startup (from the root layout). Uses the SDK 57 banner/list fields.
 */
export function registerNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
