import { Pressable, Text, View } from 'react-native';

import { useSettingsStore, type TranslationCode } from '@/store/settings.store';

/**
 * Display name per translation code. Exported so search results can label each
 * hit with the same words the switcher uses — one place to rename a language.
 */
export const TRANSLATION_LABELS: Record<TranslationCode, string> = {
  KJV: 'English',
  ADB: 'Tagalog',
  CEB: 'Bisaya',
};

/** The three shipped translations, in the order they appear in the control. */
const OPTIONS: { code: TranslationCode; label: string }[] = (
  ['KJV', 'ADB', 'CEB'] as const
).map((code) => ({ code, label: TRANSLATION_LABELS[code] }));

/**
 * Segmented control that switches the active translation.
 *
 * @returns A three-way segmented control bound to the settings store.
 * @remarks Writes straight to the persisted store instead of taking an
 *          `onChange` prop. The choice is a durable user preference, not screen
 *          state, so lifting it into a parent would just mean every screen
 *          re-plumbing the same value back down. Every reader hook already
 *          subscribes to the store, so a tap here re-queries the chapter in the
 *          new language with no further wiring.
 */
export function TranslationSwitcher() {
  const active = useSettingsStore((s) => s.translationCode);
  const setTranslation = useSettingsStore((s) => s.setTranslation);

  return (
    <View className="flex-row rounded-2xl bg-neutral-100 p-1 dark:bg-neutral-900">
      {OPTIONS.map((option) => {
        const selected = option.code === active;
        return (
          <Pressable
            key={option.code}
            onPress={() => setTranslation(option.code)}
            className={`flex-1 rounded-xl py-2 ${selected ? 'bg-white dark:bg-neutral-700' : ''}`}>
            <Text
              className={`text-center text-xs font-semibold ${
                selected
                  ? 'text-brand-600 dark:text-brand-200'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
