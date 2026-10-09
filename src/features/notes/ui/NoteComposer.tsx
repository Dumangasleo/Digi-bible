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

import { useVoiceDictation } from '@/core/speech/useVoiceDictation';
import { AppButton } from '@/shared/ui/AppButton';
import { formatReference } from '@/shared/utils/reference';
import { useSettingsStore, type TranslationCode } from '@/store/settings.store';

import { useNotes } from '../hooks/useNotes';
import { type Note } from '../types';

/**
 * Speech-recognition locale per translation. Dictating a Bisaya note with an
 * `en-US` recognizer produces confident nonsense, so the locale follows the
 * translation the user is actually reading.
 */
const DICTATION_LOCALE: Record<TranslationCode, string> = {
  KJV: 'en-US',
  ADB: 'tl-PH',
  CEB: 'ceb-PH',
};

interface NoteComposerProps {
  /** Verse this note is anchored to. Required even when editing. */
  reference: { bookId: number; bookName: string; chapter: number; verse: number };
  translationId: number | null;
  /** Pass a note to edit it; omit to create a new one. */
  note?: Note | null;
  onClose: () => void;
  /** Called after a successful write, so the parent can reload its list. */
  onSaved: () => void;
}

/**
 * Create/edit sheet for a verse-anchored note, with voice dictation.
 *
 * @param reference - The verse the note hangs off.
 * @param translationId - Translation the note was taken in; may be `null`.
 * @param note - Existing note to edit, or `null`/omitted to create.
 * @param onClose - Dismiss handler.
 * @param onSaved - Fired after a successful save, before `onClose`.
 * @returns The composer modal.
 * @remarks **Mounted only while open** — the parent renders it conditionally, so
 *          the form initializes from `note` once via lazy `useState` and resets
 *          by unmounting. A "copy props into state when `visible` flips" effect
 *          would be an extra render pass and a second source of truth.
 *
 *          One component for both create and edit. The two differ only in which
 *          service call fires on save; splitting them would duplicate the whole
 *          form, including the dictation wiring, which is the non-trivial part.
 *
 *          **Dictation appends rather than replaces.** `baseBody` snapshots
 *          whatever was typed when the mic started, and the displayed text is
 *          *derived* as `baseBody + transcript` while listening. Deriving it
 *          instead of writing each interim transcript into state means no render
 *          cascade per recognized word, and it makes it structurally impossible
 *          for an interim result to clobber hand-typed text.
 *
 *          A save failure surfaces in the form and leaves the sheet open with the
 *          text intact. Closing on error would discard what the user just dictated.
 */
export function NoteComposer({
  reference,
  translationId,
  note = null,
  onClose,
  onSaved,
}: NoteComposerProps) {
  const notes = useNotes();
  const translationCode = useSettingsStore((s) => s.translationCode);
  const dictation = useVoiceDictation({ lang: DICTATION_LOCALE[translationCode] });

  const [title, setTitle] = useState(() => note?.Title ?? '');
  const [body, setBody] = useState(() => note?.Body ?? '');
  const [baseBody, setBaseBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // While listening, what the user sees is the typed baseline plus the live
  // transcript. Committed back into `body` the moment dictation stops.
  const displayBody = dictation.recognizing ? baseBody + dictation.transcript : body;

  /**
   * Starts or stops dictation, snapshotting the typed text on start and
   * committing the transcript on stop.
   *
   * @remarks Snapshot-then-append is what makes "type a bit, dictate the rest"
   *          work. The trailing space stops the dictated clause running into the
   *          last typed word.
   */
  function toggleDictation() {
    if (dictation.recognizing) {
      dictation.stop();
      setBody(baseBody + dictation.transcript);
      return;
    }
    setBaseBody(body.trim() ? `${body.trim()} ` : '');
    dictation.reset();
    void dictation.start();
  }

  /**
   * Persists the note, creating or updating depending on `note`.
   *
   * @returns Resolves once the write finishes; the sheet closes only on success.
   * @remarks Saves `displayBody`, not `body`, so hitting Save mid-dictation keeps
   *          the words still in flight rather than silently dropping them.
   */
  async function save() {
    const finalBody = displayBody.trim();
    if (!finalBody) {
      setError('Write or dictate something first.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (dictation.recognizing) dictation.stop();

      if (note) {
        await notes.edit(note.Id, { title: title.trim() || null, body: finalBody });
      } else {
        await notes.add({
          bookId: reference.bookId,
          chapter: reference.chapter,
          verseStart: reference.verse,
          translationId,
          title: title.trim() || null,
          body: finalBody,
        });
      }
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the note.');
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
              {note ? 'Edit note' : 'New note'}
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
            <View className="mb-4 self-start rounded-full bg-brand-50 px-3 py-1 dark:bg-brand-900/40">
              <Text className="text-xs font-semibold text-brand-700 dark:text-brand-200">
                {formatReference(reference.bookName, reference.chapter, reference.verse)}
              </Text>
            </View>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title (optional)"
              placeholderTextColor="#a3a3a3"
              className="mb-4 rounded-2xl bg-neutral-100 px-4 py-3 text-base text-neutral-900 dark:bg-neutral-900 dark:text-white"
            />

            <TextInput
              value={displayBody}
              onChangeText={setBody}
              editable={!dictation.recognizing}
              placeholder="What is God showing you here?"
              placeholderTextColor="#a3a3a3"
              multiline
              textAlignVertical="top"
              className="min-h-[180px] rounded-2xl bg-neutral-100 px-4 py-3 text-base leading-6 text-neutral-900 dark:bg-neutral-900 dark:text-white"
            />

            <View className="mt-4">
              <AppButton
                label={dictation.recognizing ? 'Stop dictation' : 'Dictate note'}
                variant={dictation.recognizing ? 'danger' : 'secondary'}
                onPress={toggleDictation}
              />
            </View>

            {dictation.recognizing ? (
              <Text className="mt-3 text-center text-xs text-neutral-500">
                Listening in {DICTATION_LOCALE[translationCode]}
              </Text>
            ) : null}

            {dictation.error ? (
              <Text className="mt-3 text-center text-xs text-red-500">
                {dictation.error}
              </Text>
            ) : null}

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
