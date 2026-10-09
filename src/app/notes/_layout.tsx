import { Stack } from 'expo-router';

/**
 * Stack nested inside the Notes tab: list → new / detail.
 *
 * @returns The Notes tab's navigator.
 * @remarks Gives the tab its own back history, so Back from a topic returns to
 *          the list without leaving the tab. The root layout still sees a single
 *          route named `notes`, so the tab bar is untouched. Headers are off
 *          because every screen in this app draws its own.
 */
export default function NotesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
