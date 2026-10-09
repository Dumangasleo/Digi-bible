import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  BookPickerModal,
  SearchModal,
  TranslationSwitcher,
  useActiveTranslation,
  useBooks,
  useVerse,
} from '@/features/bible-reader';
import { useTopics, type VerseRef } from '@/features/notes';
import { HighlightableText, toggleWord } from '@/shared/ui/HighlightableText';
import { Screen } from '@/shared/ui/Screen';
import { formatReference } from '@/shared/utils/reference';

/**
 * Create-topic screen: Title → Bible verse → Description → Save.
 *
 * @returns The screen.
 * @remarks **This route is where bible-reader and notes meet.** It owns both
 *          verse pickers (browse by book/chapter/verse, or full-text search) and
 *          calls `topics.create` — neither feature knows the other exists. The
 *          form lives inline here rather than in notes/ui because this screen is
 *          its only user.
 *
 *          The picked verse's text is previewed under the reference, so a verse
 *          chosen by number is confirmed by reading it before it is saved. The
 *          language switcher above it is the app-wide reading language (the same
 *          setting as the Read tab), so the preview can be read in English,
 *          Tagalog or Bisaya. Search needs no switcher: it covers all three.
 *
 *          There is no date field: `Topics.CreatedAt` defaults to SQLite's clock
 *          on INSERT, so it can be neither forgotten nor faked.
 */
export default function NewTopicScreen() {
  const router = useRouter();
  const topics = useTopics();
  const { translationId } = useActiveTranslation();
  const { books, byId } = useBooks(translationId);

  const [title, setTitle] = useState('');
  const [verse, setVerse] = useState<VerseRef | null>(null);
  const [description, setDescription] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { verse: preview, loading: previewLoading } = useVerse(translationId, verse);

  // Highlighted words on the preview, tagged with the verse + language they were
  // made on, so picking another verse or switching language derives an empty
  // selection instead of carrying positions that now point at other words.
  const [marked, setMarked] = useState<{ key: string; words: number[] }>({ key: '', words: [] });
  const markKey = verse ? `${translationId}:${verse.bookId}:${verse.chapter}:${verse.verse}` : '';
  const markedWords = marked.key === markKey ? marked.words : [];

  const verseLabel = verse
    ? formatReference(
        byId.get(verse.bookId)?.Name ?? `Book ${verse.bookId}`,
        verse.chapter,
        verse.verse,
      )
    : null;

  /**
   * Receives a reference from either picker.
   *
   * @param bookId - Chosen book.
   * @param chapter - Chosen chapter.
   * @param v - Chosen verse. Always set here: the browse picker runs with
   *            `pickVerse`, and search hits always carry their verse.
   */
  function onVersePicked(bookId: number, chapter: number, v?: number) {
    setPickerOpen(false);
    if (v == null) return;
    setVerse({ bookId, chapter, verse: v });
    setError(null);
  }

  /**
   * Validates and creates the topic with its first verse, then returns to the list.
   *
   * @remarks The checks here give instant feedback; the service re-checks the
   *          title because the service is the contract and this screen is just
   *          one caller. On failure everything typed stays on screen.
   */
  async function save() {
    if (!title.trim()) {
      setError('Give the topic a title.');
      return;
    }
    if (!verse) {
      setError('Pick a Bible verse for this topic.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await topics.create({
        title,
        description,
        firstVerse: verse,
        translationId,
        firstHighlights: markedWords,
      });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the topic.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center justify-between border-b border-neutral-200 px-5 pb-3 dark:border-neutral-800">
          <Pressable onPress={() => router.back()}>
            <Text className="text-base font-medium text-brand-500">Cancel</Text>
          </Pressable>
          <Text className="text-base font-bold text-neutral-900 dark:text-white">New topic</Text>
          <Pressable onPress={save} disabled={saving}>
            <Text
              className={`text-base font-semibold ${saving ? 'text-neutral-400' : 'text-brand-500'}`}>
              Save
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Title
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Pagtuo"
            placeholderTextColor="#a3a3a3"
            className="mb-5 rounded-2xl bg-neutral-100 px-4 py-3 text-base text-neutral-900 dark:bg-neutral-900 dark:text-white"
          />

          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Bible verse
          </Text>
          <View className="mb-5 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-900">
            <View className="mb-3">
              <TranslationSwitcher />
            </View>
            {verseLabel ? (
              <>
                <Text className="text-sm font-bold uppercase tracking-wider text-brand-500">
                  {verseLabel}
                </Text>
                {previewLoading ? (
                  <Text className="mt-1 text-base text-neutral-500">Loading…</Text>
                ) : preview?.Text ? (
                  <>
                    <HighlightableText
                      text={preview.Text}
                      highlighted={markedWords}
                      onToggleWord={(w) =>
                        setMarked({ key: markKey, words: toggleWord(markedWords, w) })
                      }
                      className="mt-1 text-base leading-7 text-neutral-800 dark:text-neutral-200"
                    />
                    <Text className="mt-2 text-xs text-neutral-500">
                      {markedWords.length > 0
                        ? `🖍 ${markedWords.length} ${markedWords.length === 1 ? 'word' : 'words'} highlighted`
                        : 'Tap words to highlight them.'}
                    </Text>
                  </>
                ) : (
                  <Text className="mt-1 text-base text-neutral-500">
                    (Verse text not imported for this translation.)
                  </Text>
                )}
              </>
            ) : (
              <Text className="text-base text-neutral-400">No verse picked yet</Text>
            )}

            <View className="mt-3 flex-row gap-2">
              <Pressable
                onPress={() => setPickerOpen(true)}
                className="flex-1 rounded-xl bg-white py-2.5 active:opacity-70 dark:bg-neutral-800">
                <Text className="text-center text-sm font-semibold text-brand-500">📖 Browse</Text>
              </Pressable>
              <Pressable
                onPress={() => setSearchOpen(true)}
                className="flex-1 rounded-xl bg-white py-2.5 active:opacity-70 dark:bg-neutral-800">
                <Text className="text-center text-sm font-semibold text-brand-500">🔍 Search</Text>
              </Pressable>
            </View>
          </View>

          <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is this topic about?"
            placeholderTextColor="#a3a3a3"
            multiline
            textAlignVertical="top"
            className="min-h-[120px] rounded-2xl bg-neutral-100 px-4 py-3 text-base leading-6 text-neutral-900 dark:bg-neutral-900 dark:text-white"
          />

          {error ? (
            <Text className="mt-4 text-center text-sm font-medium text-red-500">{error}</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <BookPickerModal
        visible={pickerOpen}
        books={books}
        pickVerse
        onSelect={onVersePicked}
        onClose={() => setPickerOpen(false)}
      />

      {searchOpen ? (
        <SearchModal
          booksById={byId}
          onSelect={onVersePicked}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}
    </Screen>
  );
}
