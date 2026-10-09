import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { AppButton } from '@/shared/ui/AppButton';
import { notify } from '@/shared/ui/notify';
import { formatReference } from '@/shared/utils/reference';

import { useTopics } from '../hooks/useTopics';
import { type TopicList, type TopicSummary, type VerseRef } from '../types';
import { TopicCard } from './TopicCard';

const EMPTY_LIST: TopicList = { topics: [], uncategorizedCount: 0 };

interface TopicPickerModalProps {
  /** The verse being filed. */
  verse: VerseRef;
  /** That verse, pre-formatted by the caller, e.g. "John 3:16". */
  verseLabel: string;
  translationId: number | null;
  /** Words highlighted in the reader before opening this sheet; saved with the verse. */
  highlights?: number[];
  /** Resolves a BookId to its display name, for each topic card's first verse. */
  bookName: (bookId: number) => string;
  onClose: () => void;
  /** Fired after the verse was filed, just before `onClose`. */
  onAdded: () => void;
}

/**
 * "Add to topic" sheet: file one verse under an existing topic, or create a new
 * topic around it. There is deliberately no "no topic" option.
 *
 * @param verse - The verse to file.
 * @param verseLabel - Its formatted reference, shown at the top.
 * @param translationId - Translation the verse was read in.
 * @param bookName - BookId → name. Injected rather than imported: book names
 *                   belong to bible-reader, which the notes feature must not
 *                   import. The caller (a route) owns that lookup and lends it.
 * @param onClose - Dismiss handler.
 * @param onAdded - Fired after a successful add or create.
 * @returns The sheet.
 * @remarks Creating a topic here needs only a title and description — the verse
 *          is already known — so it happens inline instead of navigating to
 *          /notes/new. Staying inside the modal keeps the reader exactly where
 *          it was, and avoids a cross-tab jump whose Back button would land on
 *          the Notes list instead of the chapter being read.
 *
 *          With no topics yet, the list would be empty and useless, so the
 *          create form is shown straight away.
 */
export function TopicPickerModal({
  verse,
  verseLabel,
  translationId,
  highlights = [],
  bookName,
  onClose,
  onAdded,
}: TopicPickerModalProps) {
  const topics = useTopics();
  const loader = useCallback(() => topics.list(), [topics]);
  const { data, loading } = useAsyncData<TopicList>(loader, EMPTY_LIST);

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTopics = data.topics.length > 0;
  const showForm = creating || (!loading && !hasTopics);

  /**
   * Formats a topic's first verse for its card.
   *
   * @param t - The topic summary.
   * @returns e.g. "Hebrews 11:1", or null if the topic has no verse left.
   */
  function firstVerseLabel(t: TopicSummary): string | null {
    if (t.FirstBookId == null || t.FirstChapter == null || t.FirstVerse == null) return null;
    return formatReference(bookName(t.FirstBookId), t.FirstChapter, t.FirstVerse);
  }

  /**
   * Runs one write, then confirms it to the user and closes; on failure keeps
   * the sheet open with the message.
   *
   * @param write - The add or create call.
   * @param successMessage - Shown as a toast once the write has committed.
   * @remarks The toast fires only after `await write()` resolves, so "added" is
   *          never shown for a write that then failed. `busy` blocks a second tap
   *          while the first write is in flight — a convenience only; the real
   *          duplicate guard is the UNIQUE index.
   */
  async function run(write: () => Promise<unknown>, successMessage: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await write();
      notify(successMessage);
      onAdded();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.');
      setBusy(false);
    }
  }

  /**
   * Asks for confirmation, then files the verse under an existing topic.
   *
   * @param topic - The tapped topic.
   * @remarks A tap on a card is easy to make by accident while scrolling the
   *          list, and the result lands in another screen the user can't see from
   *          here — so it is confirmed by name first. Idempotent: a verse already
   *          in the topic is left as it is.
   */
  function addToTopic(topic: TopicSummary) {
    if (busy) return;
    Alert.alert('Add to topic?', `Add "${verseLabel}" to topic "${topic.Title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: () => {
          void run(
            () => topics.addVerse({ topicId: topic.Id, ...verse, translationId, highlights }),
            `${verseLabel} added to "${topic.Title}"`,
          );
        },
      },
    ]);
  }

  /**
   * Validates the title, then creates a topic whose first verse is this one.
   *
   * @remarks No confirmation dialog here: pressing "Create topic" after typing a
   *          title is already a deliberate act, so a second prompt would be noise.
   */
  function createTopic() {
    if (!title.trim()) {
      setError('Give the topic a title.');
      return;
    }
    void run(
      () =>
        topics.create({
          title,
          description,
          firstVerse: verse,
          translationId,
          firstHighlights: highlights,
        }),
      `Topic "${title.trim()}" created with ${verseLabel}`,
    );
  }

  /** Back from the form to the list when there is one; otherwise close. */
  function goBack() {
    if (showForm && hasTopics) {
      setCreating(false);
      setError(null);
      return;
    }
    onClose();
  }

  return (
    <Modal visible animationType="slide" onRequestClose={goBack}>
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-row items-center justify-between border-b border-neutral-200 px-5 pb-3 dark:border-neutral-800">
            <Pressable onPress={goBack}>
              <Text className="text-base font-medium text-brand-500">
                {showForm && hasTopics ? '‹ Topics' : 'Cancel'}
              </Text>
            </Pressable>
            <Text className="text-base font-bold text-neutral-900 dark:text-white">
              {showForm ? 'New topic' : 'Add to topic'}
            </Text>
            {/* Spacer keeps the heading optically centered without a layout measure. */}
            <View className="w-16" />
          </View>

          <View className="px-5 pt-4">
            <View className="self-start rounded-full bg-brand-50 px-3 py-1 dark:bg-brand-900/40">
              <Text className="text-xs font-semibold text-brand-700 dark:text-brand-200">
                {verseLabel}
              </Text>
            </View>
            {error ? (
              <Text className="mt-3 text-sm font-medium text-red-500">{error}</Text>
            ) : null}
          </View>

          {showForm ? (
            <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
              <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Title
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Pagtuo"
                placeholderTextColor="#a3a3a3"
                autoFocus
                className="mb-5 rounded-2xl bg-neutral-100 px-4 py-3 text-base text-neutral-900 dark:bg-neutral-900 dark:text-white"
              />
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
                className="mb-5 min-h-[100px] rounded-2xl bg-neutral-100 px-4 py-3 text-base leading-6 text-neutral-900 dark:bg-neutral-900 dark:text-white"
              />
              <AppButton
                label={busy ? 'Saving…' : 'Create topic'}
                onPress={createTopic}
                disabled={busy}
              />
            </ScrollView>
          ) : loading ? (
            <View className="py-12">
              <ActivityIndicator color="#208aef" />
            </View>
          ) : (
            <FlatList
              data={data.topics}
              keyExtractor={(t) => String(t.Id)}
              contentContainerClassName="p-5"
              ListHeaderComponent={
                <Pressable
                  onPress={() => setCreating(true)}
                  className="mb-3 rounded-2xl border border-dashed border-brand-300 p-4 active:opacity-70 dark:border-brand-700">
                  <Text className="text-center text-base font-semibold text-brand-500">
                    ＋ New topic
                  </Text>
                </Pressable>
              }
              renderItem={({ item }) => (
                <TopicCard
                  topic={item}
                  verseLabel={firstVerseLabel(item)}
                  onPress={() => addToTopic(item)}
                />
              )}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
