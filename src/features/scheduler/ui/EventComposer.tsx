import { isValid, parse } from 'date-fns';
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

import { toLocalDay } from '@/shared/utils/date';

import { useEvents } from '../hooks/useEvents';

/** Reminder presets, in minutes before the start. `null` means no reminder. */
const REMINDERS: { label: string; minutes: number | null }[] = [
  { label: 'None', minutes: null },
  { label: '10 min', minutes: 10 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '1 day', minutes: 1440 },
];

const DEFAULT_TIME = '09:00';
const DEFAULT_REMINDER = 30;

interface EventComposerProps {
  onClose: () => void;
  /** Called after a successful create, so the parent can reload its list. */
  onSaved: () => void;
}

/**
 * Create sheet for a church event and its reminder.
 *
 * @param onClose - Dismiss handler.
 * @param onSaved - Fired after a successful create, before `onClose`.
 * @returns The composer modal.
 * @remarks **Mounted only while open**, so the form starts clean by construction
 *          instead of being wiped by an effect. `toLocalDay()` reads the clock,
 *          which is impure, so it runs in a lazy `useState` initializer — once at
 *          mount — rather than on every render.
 *
 *          **Date entry is typed, not picked.** A native date/time picker needs
 *          `@react-native-community/datetimepicker`, a new native dependency that
 *          would force another EAS build — flagged rather than added silently.
 *          Typed `YYYY-MM-DD` / `HH:mm` is unglamorous but validates strictly and
 *          behaves identically on both platforms today.
 *
 *          Validation uses `date-fns.parse` with an explicit format, not
 *          `new Date(string)`. `new Date('2026-13-45')` is not a reliable
 *          rejection across engines; `parse` + `isValid` is.
 *
 *          The local wall-clock components become a UTC instant via
 *          `toISOString()` exactly once, here. Everything downstream — the row,
 *          the reminder, the sort — is UTC, so no other layer has to reason about
 *          which zone a timestamp is in.
 */
export function EventComposer({ onClose, onSaved }: EventComposerProps) {
  const events = useEvents();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [day, setDay] = useState(() => toLocalDay());
  const [time, setTime] = useState(DEFAULT_TIME);
  const [reminder, setReminder] = useState<number | null>(DEFAULT_REMINDER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validates the typed date and time and creates the event.
   *
   * @returns Resolves once the write finishes; the sheet closes only on success.
   * @remarks Service errors are caught and rendered in the form rather than
   *          thrown onward — an unhandled rejection here would lose everything
   *          the user typed.
   */
  async function save() {
    const startsAtLocal = parse(`${day} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    if (!isValid(startsAtLocal)) {
      setError('Check the date (YYYY-MM-DD) and time (HH:mm).');
      return;
    }
    if (!title.trim()) {
      setError('Give the event a title.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await events.create({
        title: title.trim(),
        location: location.trim() || null,
        description: description.trim() || null,
        startsAt: startsAtLocal.toISOString(),
        reminderMinutes: reminder,
      });
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the event.');
    } finally {
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
            <Text className="text-base font-bold text-neutral-900 dark:text-white">
              New event
            </Text>
            <Pressable onPress={save} disabled={saving}>
              <Text
                className={`text-base font-semibold ${
                  saving ? 'text-neutral-400' : 'text-brand-500'
                }`}>
                Save
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Sunday Worship Service"
              placeholderTextColor="#a3a3a3"
              className="mb-4 rounded-2xl bg-neutral-100 px-4 py-3 text-base text-neutral-900 dark:bg-neutral-900 dark:text-white"
            />
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Location (optional)"
              placeholderTextColor="#a3a3a3"
              className="mb-4 rounded-2xl bg-neutral-100 px-4 py-3 text-base text-neutral-900 dark:bg-neutral-900 dark:text-white"
            />

            <View className="mb-4 flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Date
                </Text>
                <TextInput
                  value={day}
                  onChangeText={setDay}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#a3a3a3"
                  autoCapitalize="none"
                  className="rounded-2xl bg-neutral-100 px-4 py-3 text-base text-neutral-900 dark:bg-neutral-900 dark:text-white"
                />
              </View>
              <View className="w-32">
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Time
                </Text>
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  placeholder="HH:mm"
                  placeholderTextColor="#a3a3a3"
                  className="rounded-2xl bg-neutral-100 px-4 py-3 text-base text-neutral-900 dark:bg-neutral-900 dark:text-white"
                />
              </View>
            </View>

            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Remind me
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-2">
              {REMINDERS.map((option) => {
                const selected = option.minutes === reminder;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => setReminder(option.minutes)}
                    className={`rounded-full px-4 py-2 ${
                      selected ? 'bg-brand-500' : 'bg-neutral-100 dark:bg-neutral-900'
                    }`}>
                    <Text
                      className={`text-sm font-medium ${
                        selected ? 'text-white' : 'text-neutral-600 dark:text-neutral-300'
                      }`}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Notes (optional)"
              placeholderTextColor="#a3a3a3"
              multiline
              textAlignVertical="top"
              className="min-h-[100px] rounded-2xl bg-neutral-100 px-4 py-3 text-base leading-6 text-neutral-900 dark:bg-neutral-900 dark:text-white"
            />

            {error ? (
              <Text className="mt-4 text-center text-sm font-medium text-red-500">
                {error}
              </Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
