import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenPlaceholderProps {
  emoji: string;
  title: string;
  subtitle: string;
  phase?: string;
}

/**
 * Styled empty-state used by feature tabs until their real UI is built.
 * Pure NativeWind (Tailwind) — no StyleSheet.
 */
export function ScreenPlaceholder({
  emoji,
  title,
  subtitle,
  phase = 'Coming soon',
}: ScreenPlaceholderProps) {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top']}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="mb-4 text-6xl">{emoji}</Text>
        <Text className="text-center text-2xl font-bold text-neutral-900 dark:text-white">
          {title}
        </Text>
        <Text className="mt-2 text-center text-base text-neutral-500 dark:text-neutral-400">
          {subtitle}
        </Text>
        <View className="mt-6 rounded-full bg-brand-50 px-4 py-1.5 dark:bg-brand-900/40">
          <Text className="text-sm font-medium text-brand-700 dark:text-brand-200">{phase}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
