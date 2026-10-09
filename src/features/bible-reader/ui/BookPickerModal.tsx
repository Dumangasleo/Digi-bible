import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAsyncData } from '@/shared/hooks/useAsyncData';

import { bibleService } from '../services/bible.service';
import { type Book } from '../types';

interface BookPickerModalProps {
  visible: boolean;
  books: Book[];
  /** Adds a third step to choose a verse. Reader navigation leaves it off. */
  pickVerse?: boolean;
  /** `verse` is set only when `pickVerse` is on. */
  onSelect: (bookId: number, chapter: number, verse?: number) => void;
  onClose: () => void;
}

/**
 * A wrap-around grid of numbered buttons, 1..count.
 *
 * @param count - How many buttons to draw.
 * @param onPick - Called with the tapped number.
 * @returns The grid.
 * @remarks One component for both the chapter and the verse step — same UI,
 *          different meaning — so a styling change lands in both at once.
 */
function NumberGrid({ count, onPick }: { count: number; onPick: (n: number) => void }) {
  return (
    <ScrollView contentContainerClassName="flex-row flex-wrap gap-3 p-5">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <Pressable
          key={n}
          onPress={() => onPick(n)}
          className="h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 active:bg-brand-100 dark:bg-neutral-900">
          <Text className="text-base font-semibold text-neutral-900 dark:text-white">{n}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/**
 * Reference picker: book → chapter, plus an optional verse step.
 *
 * @param visible - Whether the modal is shown.
 * @param books - All 66 books, already name-localized.
 * @param pickVerse - When true, a third step picks the verse.
 * @param onSelect - Called with the chosen reference. The modal does not close
 *                   itself — the parent owns `visible`.
 * @param onClose - Called on dismiss without a selection.
 * @returns The picker modal.
 * @remarks Two steps for reader navigation, three for choosing a verse — one
 *          component, so the book list and chapter grid exist in one place only.
 *          Local state resets on every exit, so reopening starts at the book list.
 *
 *          The verse count loads only once a chapter is chosen; before that the
 *          loader resolves to 0 without touching the database.
 */
export function BookPickerModal({
  visible,
  books,
  pickVerse = false,
  onSelect,
  onClose,
}: BookPickerModalProps) {
  const db = useSQLiteContext();
  const [pendingBook, setPendingBook] = useState<Book | null>(null);
  const [pendingChapter, setPendingChapter] = useState<number | null>(null);

  const verseCountLoader = useCallback(
    () =>
      pendingBook && pendingChapter != null
        ? bibleService.getVerseCount(db, pendingBook.Id, pendingChapter)
        : Promise.resolve(0),
    [db, pendingBook, pendingChapter],
  );
  const { data: verseCount, loading: countingVerses } = useAsyncData<number>(
    verseCountLoader,
    0,
  );

  /** Resets and closes, so the next open starts at the book list. */
  function dismiss() {
    setPendingBook(null);
    setPendingChapter(null);
    onClose();
  }

  /** Steps back one level: verse → chapter → book list → close. */
  function goBack() {
    if (pendingChapter != null) setPendingChapter(null);
    else if (pendingBook) setPendingBook(null);
    else dismiss();
  }

  /**
   * Handles a chapter tap: finishes the pick, or moves on to the verse step.
   *
   * @param chapter - The tapped chapter.
   */
  function chooseChapter(chapter: number) {
    if (!pendingBook) return;
    if (pickVerse) {
      setPendingChapter(chapter);
      return;
    }
    onSelect(pendingBook.Id, chapter);
    setPendingBook(null);
  }

  /**
   * Handles a verse tap and finishes the pick.
   *
   * @param verse - The tapped verse.
   */
  function chooseVerse(verse: number) {
    if (!pendingBook || pendingChapter == null) return;
    onSelect(pendingBook.Id, pendingChapter, verse);
    setPendingBook(null);
    setPendingChapter(null);
  }

  const backLabel = pendingChapter != null ? '‹ Chapters' : pendingBook ? '‹ Books' : 'Close';
  const heading =
    pendingBook && pendingChapter != null
      ? `${pendingBook.Name} ${pendingChapter}`
      : pendingBook
        ? pendingBook.Name
        : 'Select a book';

  return (
    // Android back steps back one level instead of closing the whole picker.
    <Modal visible={visible} animationType="slide" onRequestClose={goBack}>
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top']}>
        <View className="flex-row items-center justify-between border-b border-neutral-200 px-5 pb-3 dark:border-neutral-800">
          <Pressable onPress={goBack}>
            <Text className="text-base font-medium text-brand-500">{backLabel}</Text>
          </Pressable>
          <Text className="text-base font-bold text-neutral-900 dark:text-white">{heading}</Text>
          {/* Spacer keeps the heading optically centered without a layout measure. */}
          <View className="w-16" />
        </View>

        {pendingBook && pendingChapter != null ? (
          countingVerses ? (
            <View className="py-12">
              <ActivityIndicator color="#208aef" />
            </View>
          ) : verseCount === 0 ? (
            <Text className="px-8 py-12 text-center text-sm text-neutral-500">
              No verse text imported for this chapter.
            </Text>
          ) : (
            <NumberGrid count={verseCount} onPick={chooseVerse} />
          )
        ) : pendingBook ? (
          <NumberGrid count={pendingBook.ChapterCount} onPick={chooseChapter} />
        ) : (
          <FlatList
            data={books}
            keyExtractor={(book) => String(book.Id)}
            contentContainerClassName="px-5 pb-10"
            renderItem={({ item, index }) => (
              <View>
                {/* Testament divider: the testament flips once, Malachi → Matthew. */}
                {index === 0 || books[index - 1].Testament !== item.Testament ? (
                  <Text className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-neutral-400">
                    {item.Testament === 'OT' ? 'Old Testament' : 'New Testament'}
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => setPendingBook(item)}
                  className="flex-row items-center justify-between py-3">
                  <Text className="text-base text-neutral-900 dark:text-white">{item.Name}</Text>
                  <Text className="text-sm text-neutral-400">{item.ChapterCount}</Text>
                </Pressable>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
