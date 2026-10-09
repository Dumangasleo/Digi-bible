import { Pressable, Text } from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
}

/** Tailwind classes per visual variant, kept out of the component body. */
const VARIANTS: Record<Variant, { container: string; text: string }> = {
  primary: { container: 'bg-brand-500', text: 'text-white' },
  secondary: {
    container: 'bg-neutral-200 dark:bg-neutral-800',
    text: 'text-neutral-900 dark:text-white',
  },
  danger: { container: 'bg-red-500', text: 'text-white' },
};

/**
 * The app's only button. Three variants, no size prop, no icon slot.
 *
 * @param label - Button text.
 * @param onPress - Tap handler.
 * @param variant - Visual weight; defaults to `primary`.
 * @param disabled - Blocks presses and dims the button.
 * @returns A pressable button.
 * @remarks A lookup table instead of conditional class strings: adding a variant
 *          is a new entry, not an edit to the render path.
 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: AppButtonProps) {
  const style = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`rounded-2xl px-5 py-3 ${style.container} ${disabled ? 'opacity-40' : 'active:opacity-80'}`}>
      <Text className={`text-center text-base font-semibold ${style.text}`}>{label}</Text>
    </Pressable>
  );
}
