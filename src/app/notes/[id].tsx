import { format, parseISO } from 'date-fns';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import {
  BookPickerModal,
  SearchModal,
  TranslationSwitcher,
  useActiveTranslation,
  useBooks,
} from '@/features/bible-reader';
import {
  TopicFormSheet,
  useTopics,
  type SheetField,
  type TopicDetail,
  type TopicText,
  type TopicVerse,
} from '@/features/notes';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { AppButton } from '@/shared/ui/AppButton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { HighlightableText, toggleWord } from '@/shared/ui/HighlightableText';
import { Screen } from '@/shared/ui/Screen';
import { formatReference } from '@/shared/utils/reference';

const EMPTY_DETAIL: TopicDetail = { topic: null, verses: [], items: [] };

/** Which form sheet is open, if any. */
type Sheet =
  | { kind: 'editTopic' }
  | { kind: 'addText' }
  | { kind: 'editText'; text: TopicText }
  | null;

/**
 * One topic's page: header, then its verses and description blocks in the order
 * they were added. The id "none" renders the "Walay Topic" group instead.
 *
 * @returns The detail screen.
 * @remarks Verse text and highlights follow the app-wide reading language,
 *          switchable right here; `translationId` is a loader dependency, so
 *          tapping "Bisaya" re-queries the whole topic in Bisaya.
 *
 *          Everything new — a verse or a description — is appended at the
 *          bottom, so a description explains the verses that come after it.
 *
 *          Highlighting is per verse and per language: tap 🖍, tap words, Save.
 *          Only one verse is in highlight mode at a time, which keeps the
 *          unsaved selection in a single piece of state.
 */
export default function TopicDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  // 'none' is the "Walay Topic" group; everything else is a Topics.Id.
  const topicId = id === 'none' ? null : Number(id);
  const isUncategorized = topicId === null;

  const topics = useTopics();
  const { translationId } = useActiveTranslation();
  const { books, byId } = useBooks(translationId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [highlighting, setHighlighting] = useState<{ noteId: number; words: number[] } | null>(
    null,
  );

  const loader = useCallback(
    () =>
      translationId == null
        ? Promise.resolve(EMPTY_DETAIL)
        : topics.detail(topicId, translationId),
    [topics, topicId, translationId],
  );
  const { data, loading, reload } = useAsyncData<TopicDetail>(loader, EMPTY_DETAIL);
  useFocusEffect(reload);

  const { topic, verses, items } = data;

  /**
   * Files a picked verse under this topic, at the bottom.
   *
   * @param bookId - Chosen book.
   * @param chapter - Chosen chapter.
   * @param verse - Chosen verse.
   * @remarks Idempotent — a verse already in the topic is not duplicated. A
   *          failure is shown, never swallowed.
   */
  async function addVerse(bookId: number, chapter: number, verse?: number) {
    setPickerOpen(false);
    if (verse == null || topicId == null) return;
    try {
      await topics.addVerse({ topicId, bookId, chapter, verse, translationId });
      reload();
    } catch (cause) {
      Alert.alert('Could not add verse', cause instanceof Error ? cause.message : String(cause));
    }
  }

  /**
   * Saves the words picked in highlight mode for the current language.
   *
   * @remarks Stored against `translationId`: the same positions would point at
   *          different words in another language.
   */
  async function saveHighlights() {
    if (!highlighting || translationId == null) return;
    try {
      await topics.setHighlights(highlighting.noteId, translationId, highlighting.words);
      setHighlighting(null);
      reload();
    } catch (cause) {
      Alert.alert('Could not save highlight', cause instanceof Error ? cause.message : String(cause));
    }
  }

  /**
   * Asks, then removes one verse from the topic.
   *
   * @param v - The verse entry to remove.
   */
  function confirmRemove(v: TopicVerse) {
    Alert.alert('Remove verse?', 'This removes the verse, its note and its highlights.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void topics.removeVerse(v.NoteId).then(reload);
        },
      },
    ]);
  }

  /**
   * Asks, then deletes a description block.
   *
   * @param t - The block to delete.
   */
  function confirmRemoveText(t: TopicText) {
    Alert.alert('Delete description?', 'The verses around it stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSheet(null);
          void topics.removeText(t.Id).then(reload);
        },
      },
    ]);
  }

  /**
   * Asks, then deletes the topic and returns to the list.
   *
   * @remarks Verses move to "Walay Topic" (SET NULL); description blocks are
   *          deleted with the topic (CASCADE). The message says both.
   */
  function confirmDeleteTopic() {
    if (topicId == null) return;
    Alert.alert(
      'Delete topic?',
      `Its ${verses.length} ${verses.length === 1 ? 'verse' : 'verses'} will move to "Walay Topic". Its descriptions will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void topics.remove(topicId).then(() => router.back());
          },
        },
      ],
    );
  }

  /**
   * Builds the open sheet's fields and save action.
   *
   * @returns Props for `TopicFormSheet`, or null when no sheet is open.
   */
  function sheetProps(): {
    heading: string;
    fields: SheetField[];
    onSubmit: (v: Record<string, string>) => Promise<void>;
    onDelete?: () => void;
  } | null {
    if (!sheet || topicId == null) return null;
    if (sheet.kind === 'editTopic') {
      return {
        heading: 'Edit topic',
        fields: [
          { key: 'title', label: 'Title', initial: topic?.Title ?? '' },
          {
            key: 'description',
            label: 'Description',
            initial: topic?.Description ?? '',
            placeholder: 'What is this topic about?',
            multiline: true,
          },
        ],
        onSubmit: async (v) => {
          await topics.update(topicId, { title: v.title, description: v.description });
          reload();
        },
      };
    }
    if (sheet.kind === 'addText') {
      return {
        heading: 'New description',
        fields: [
          {
            key: 'body',
            label: 'Description',
            initial: '',
            placeholder: 'Explain the verses that will follow…',
            multiline: true,
          },
        ],
        onSubmit: async (v) => {
          await topics.addText(topicId, v.body);
          reload();
        },
      };
    }
    const text = sheet.text;
    return {
      heading: 'Edit description',
      fields: [{ key: 'body', label: 'Description', initial: text.Body, multiline: true }],
      onSubmit: async (v) => {
        await topics.editText(text.Id, v.body);
        reload();
      },
      onDelete: () => confirmRemoveText(text),
    };
  }

  const heading = isUncategorized
    ? 'Walay Topic'
    : (topic?.Title ?? (loading ? '' : 'Topic not found'));
  const openSheet = sheetProps();

  /**
   * Renders one verse card, with its highlights and highlight mode.
   *
   * @param item - The verse entry.
   * @returns The card.
   */
  function renderVerse(item: TopicVerse) {
    const editing = highlighting?.noteId === item.NoteId;
    return (
      <View
        className={`mb-3 rounded-2xl p-4 ${
          editing
            ? 'border border-yellow-400 bg-yellow-50 dark:bg-neutral-900'
            : 'bg-neutral-100 dark:bg-neutral-900'
        }`}>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-wider text-brand-500">
            {formatReference(
              byId.get(item.BookId)?.Name ?? `Book ${item.BookId}`,
              item.Chapter,
              item.VerseStart,
              item.VerseEnd,
            )}
          </Text>
          {editing ? null : (
            <View className="flex-row items-center gap-4">
              {item.Text ? (
                <Pressable
                  onPress={() => setHighlighting({ noteId: item.NoteId, words: item.Highlights })}
                  hitSlop={8}>
                  <Text className="text-base">🖍</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => confirmRemove(item)} hitSlop={8}>
                <Text className="text-base opacity-40">🗑</Text>
              </Pressable>
            </View>
          )}
        </View>

        {item.Text ? (
          <HighlightableText
            text={item.Text}
            highlighted={editing ? (highlighting?.words ?? []) : item.Highlights}
            onToggleWord={
              editing
                ? (w) => setHighlighting((h) => (h ? { ...h, words: toggleWord(h.words, w) } : h))
                : undefined
            }
            className="mt-2 text-base leading-7 text-neutral-800 dark:text-neutral-200"
          />
        ) : (
          <Text className="mt-2 text-base leading-6 text-neutral-500">
            (Verse text not imported for this translation.)
          </Text>
        )}

        {editing ? (
          <View className="mt-3">
            <Text className="mb-2 text-xs text-neutral-500">
              Tap words to highlight them. Saved for this language only.
            </Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <AppButton label="Save" onPress={() => void saveHighlights()} />
              </View>
              <View className="flex-1">
                <AppButton
                  label="Clear"
                  variant="secondary"
                  onPress={() => setHighlighting((h) => (h ? { ...h, words: [] } : h))}
                />
              </View>
              <View className="flex-1">
                <AppButton
                  label="Cancel"
                  variant="secondary"
                  onPress={() => setHighlighting(null)}
                />
              </View>
            </View>
          </View>
        ) : null}

        {item.Title ? (
          <Text className="mt-3 text-sm font-semibold text-neutral-900 dark:text-white">
            {item.Title}
          </Text>
        ) : null}
        {item.Body ? (
          <Text className="mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-300">
            📝 {item.Body}
          </Text>
        ) : null}
      </View>
    );
  }

  /**
   * Renders one description block. Tapping it opens the edit sheet.
   *
   * @param text - The block.
   * @returns The block.
   */
  function renderText(text: TopicText) {
    return (
      <Pressable
        onPress={() => setSheet({ kind: 'editText', text })}
        className="mb-3 border-l-4 border-brand-500 py-1 pl-4 pr-2 active:opacity-70">
        <Text className="text-base leading-6 text-neutral-800 dark:text-neutral-200">
          {text.Body}
        </Text>
      </Pressable>
    );
  }

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        contentContainerClassName="px-5 pb-10"
        extraData={highlighting}
        ListHeaderComponent={
          <View className="pb-4 pt-2">
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => router.back()}>
                <Text className="text-base font-medium text-brand-500">‹ Notes</Text>
              </Pressable>
              {topic ? (
                <Pressable onPress={() => setSheet({ kind: 'editTopic' })} hitSlop={8}>
                  <Text className="text-base font-medium text-brand-500">✏️ Edit</Text>
                </Pressable>
              ) : null}
            </View>
            <Text className="mt-3 text-3xl font-bold text-neutral-900 dark:text-white">
              {heading}
            </Text>
            {topic?.Description ? (
              <Text className="mt-2 text-base leading-6 text-neutral-600 dark:text-neutral-300">
                {topic.Description}
              </Text>
            ) : null}
            {topic ? (
              <Text className="mt-2 text-xs text-neutral-400">
                Created {format(parseISO(topic.CreatedAt), 'd MMM yyyy')}
              </Text>
            ) : null}
            <View className="mt-4">
              <TranslationSwitcher />
            </View>
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'verse' ? renderVerse(item.verse) : renderText(item.text)
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              emoji="📖"
              title="No verses yet"
              subtitle="Add the verses that belong to this topic — browse by reference, or search by words."
            />
          )
        }
        ListFooterComponent={
          topic ? (
            <View className="mt-3">
              {/* Add actions sit at the bottom because new items are appended there. */}
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <AppButton label="📖 Verse" onPress={() => setPickerOpen(true)} />
                </View>
                <View className="flex-1">
                  <AppButton
                    label="🔍 Search"
                    variant="secondary"
                    onPress={() => setSearchOpen(true)}
                  />
                </View>
              </View>
              <View className="mt-2">
                <AppButton
                  label="＋ Description"
                  variant="secondary"
                  onPress={() => setSheet({ kind: 'addText' })}
                />
              </View>
              <View className="mt-8">
                <AppButton label="Delete topic" variant="danger" onPress={confirmDeleteTopic} />
              </View>
            </View>
          ) : null
        }
      />

      <BookPickerModal
        visible={pickerOpen}
        books={books}
        pickVerse
        onSelect={(b, c, v) => void addVerse(b, c, v)}
        onClose={() => setPickerOpen(false)}
      />

      {searchOpen ? (
        <SearchModal
          booksById={byId}
          onSelect={(b, c, v) => void addVerse(b, c, v)}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}

      {openSheet ? <TopicFormSheet {...openSheet} onClose={() => setSheet(null)} /> : null}
    </Screen>
  );
}
