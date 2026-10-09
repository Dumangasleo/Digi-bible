import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/shared/ui/AppButton';

/** One text field in the sheet. */
export interface SheetField {
  key: string;
  label: string;
  initial: string;
  placeholder?: string;
  multiline?: boolean;
}

interface TopicFormSheetProps {
  heading: string;
  fields: SheetField[];
  /** Receives the values keyed by `field.key`; throw to keep the sheet open. */
  onSubmit: (values: Record<string, string>) => Promise<void>;
  /** When set, a Delete button is shown; it should confirm on its own. */
  onDelete?: () => void;
  onClose: () => void;
}

/**
 * Small form sheet for the topic page: edit the topic itself, or add / edit a
 * description block.
 *
 * @param heading - Sheet title, e.g. "Edit topic".
 * @param fields - The fields to show, with their starting values.
 * @param onSubmit - Saves; a thrown error is shown in the sheet.
 * @param onDelete - Optional delete action.
 * @param onClose - Dismiss handler; also called after a successful save.
 * @returns The sheet.
 * @remarks Three uses share one component because they differ only in which
 *          fields appear and which service call runs on Save. Validation stays in
 *          the service (the contract); this sheet only displays its error, and
 *          keeps every typed character on failure.
 *
 *          Mounted only while open, so its state starts from `initial` each time.
 */
export function TopicFormSheet({
  heading,
  fields,
  onSubmit,
  onDelete,
  onClose,
}: TopicFormSheetProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.initial])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Runs the save, closing on success and showing the message on failure. */
  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.');
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-row items-center justify-between border-b border-neutral-200 px-5 pb-3 dark:border-neutral-800">
            <Pressable onPress={onClose}>
              <Text className="text-base font-medium text-brand-500">Cancel</Text>
            </Pressable>
            <Text className="text-base font-bold text-neutral-900 dark:text-white">{heading}</Text>
            <Pressable onPress={save} disabled={saving}>
              <Text
                className={`text-base font-semibold ${saving ? 'text-neutral-400' : 'text-brand-500'}`}>
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
            {fields.map((field, i) => (
              <View key={field.key} className="mb-5">
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  {field.label}
                </Text>
                <TextInput
                  value={values[field.key]}
                  onChangeText={(text) => setValues((v) => ({ ...v, [field.key]: text }))}
                  placeholder={field.placeholder}
                  placeholderTextColor="#a3a3a3"
                  autoFocus={i === 0}
                  multiline={field.multiline}
                  textAlignVertical={field.multiline ? 'top' : undefined}
                  className={`rounded-2xl bg-neutral-100 px-4 py-3 text-base text-neutral-900 dark:bg-neutral-900 dark:text-white ${
                    field.multiline ? 'min-h-[140px] leading-6' : ''
                  }`}
                />
              </View>
            ))}

            {error ? (
              <Text className="mb-4 text-center text-sm font-medium text-red-500">{error}</Text>
            ) : null}

            {onDelete ? (
              <AppButton label="Delete" variant="danger" onPress={onDelete} />
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
