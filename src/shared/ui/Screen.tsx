import { type ReactNode } from 'react';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

interface ScreenProps {
  children: ReactNode;
  /** Which insets to pad. Defaults to the top only — tabs handle the bottom. */
  edges?: readonly Edge[];
}

/**
 * Standard screen frame: safe-area padding plus the app's light/dark surface.
 *
 * @param children - Screen content.
 * @param edges - Safe-area edges to pad; defaults to `['top']`.
 * @returns The wrapped screen.
 * @remarks Centralizes the background colour pair so a theme change is one edit,
 *          not five. Bottom inset is excluded by default because the tab bar
 *          already occupies it — padding both leaves a visible dead strip.
 */
export function Screen({ children, edges = ['top'] }: ScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={edges}>
      {children}
    </SafeAreaView>
  );
}
