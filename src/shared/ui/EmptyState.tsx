import { Text, View } from 'react-native';

interface EmptyStateProps {
  emoji: string;
  title: string;
  subtitle: string;
  /** Optional action rendered under the text, e.g. a button. */
  action?: React.ReactNode;
}

/**
 * Inline "nothing here yet" block for a list that legitimately has no rows.
 *
 * @param emoji - Leading glyph.
 * @param title - One-line headline.
 * @param subtitle - Sentence explaining what would fill this space.
 * @param action - Optional call-to-action node.
 * @returns A centered empty-state block.
 * @remarks Separate from `ScreenPlaceholder`, which means "this feature is not
 *          built yet". This one means "the feature works, you just have no data" —
 *          two different messages that must not look identical to the user.
 */
export function EmptyState({ emoji, title, subtitle, action }: EmptyStateProps) {
  return (
    <View className="items-center px-8 py-16">
      <Text className="mb-3 text-5xl">{emoji}</Text>
      <Text className="text-center text-lg font-bold text-neutral-900 dark:text-white">
        {title}
      </Text>
      <Text className="mt-2 text-center text-sm leading-5 text-neutral-500 dark:text-neutral-400">
        {subtitle}
      </Text>
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}
