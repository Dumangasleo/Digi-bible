import '@/global.css';

import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { ActivityIndicator, Text, useColorScheme, View } from 'react-native';

import { DATABASE_NAME, initializeDatabase } from '@/core/db';
import { registerNotificationHandler } from '@/core/notifications';
import { AppButton } from '@/shared/ui/AppButton';

// Module scope, not an effect: the handler decides how a notification renders
// while the app is foregrounded, and a reminder can arrive before any component
// has mounted. Registering it in a `useEffect` would leave that window unhandled.
registerNotificationHandler();

const TABS = [
  { name: 'index', title: 'Home', icon: '🏠' },
  { name: 'read', title: 'Read', icon: '📖' },
  { name: 'notes', title: 'Notes', icon: '📝' },
  { name: 'history', title: 'History', icon: '📅' },
  { name: 'scheduler', title: 'Church', icon: '⛪' },
] as const;

/**
 * Shown while `initializeDatabase` runs — migrations on first launch, a
 * `PRAGMA user_version` read on every launch after.
 *
 * @returns A centered spinner.
 * @remarks First launch seeds 66 books and 1,189 chapters, which is visible;
 *          subsequent launches resolve in single-digit milliseconds and this
 *          never appears.
 */
function DatabaseLoading() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
      <ActivityIndicator size="large" color="#208aef" />
      <Text className="mt-4 text-sm text-neutral-500">Preparing your Bible…</Text>
    </View>
  );
}

/**
 * Route-level error boundary that expo-router mounts when this layout or any
 * child throws during render.
 *
 * @param error - The thrown error.
 * @param retry - Re-mounts the route subtree.
 * @returns A readable failure screen with a retry.
 * @remarks Exists specifically because the database now initializes at startup.
 *          A failed migration is thrown, not swallowed — but without a boundary
 *          it surfaces as a blank white screen with a redbox only in dev. This
 *          shows the actual message, which is the difference between "the app is
 *          broken" and "the app told me the schema failed to migrate".
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View className="flex-1 items-center justify-center bg-white px-8 dark:bg-neutral-950">
      <Text className="mb-3 text-5xl">⚠️</Text>
      <Text className="text-center text-lg font-bold text-neutral-900 dark:text-white">
        SmartBible could not start
      </Text>
      <Text className="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {error.message}
      </Text>
      <View className="mt-6">
        <AppButton label="Try again" onPress={() => void retry()} />
      </View>
    </View>
  );
}

/**
 * Root layout: database provider, theme, and the bottom tab bar.
 *
 * @returns The app shell.
 * @remarks `SQLiteProvider` sits **outside** `ThemeProvider` and wraps every
 *          tab, because `useSQLiteContext()` is called by hooks in all five
 *          screens. One connection is opened for the app's lifetime rather than
 *          per screen — SQLite serializes writes on a single connection, so
 *          sharing one is both cheaper and safer than several racing ones.
 *
 *          `useSuspense` lets `initializeDatabase` be awaited declaratively: no
 *          screen can render, and therefore no query can run, until migrations
 *          and seeding have finished. The alternative — a `ready` boolean in
 *          state — leaves a render pass where components exist but the schema
 *          does not, which is exactly when "no such table" fires.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <Suspense fallback={<DatabaseLoading />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase} useSuspense>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: '#208aef',
            }}>
            {TABS.map((tab) => (
              <Tabs.Screen
                key={tab.name}
                name={tab.name}
                options={{
                  title: tab.title,
                  tabBarIcon: ({ focused }) => (
                    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>
                      {tab.icon}
                    </Text>
                  ),
                }}
              />
            ))}
          </Tabs>
        </ThemeProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
