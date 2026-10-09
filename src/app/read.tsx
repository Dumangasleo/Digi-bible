import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';

import {
  BookPickerModal,
  SearchModal,
  TranslationSwitcher,
  useActiveTranslation,
  useBooks,
  useChapter,
  useReaderStore,
} from '@/features/bible-reader';
import { TopicPickerModal, useNotes, type Note } from '@/features/notes';
import { useReadingHistory } from '@/features/verse-history';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { AppButton } from '@/shared/ui/AppButton';
import { HighlightableText, toggleWord } from '@/shared/ui/HighlightableText';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Screen } from '@/shared/ui/Screen';
import { toLocalDay } from '@/shared/utils/date';
import { formatReference } from '@/shared/utils/reference';
import { useSettingsStore } from '@/store/settings.store';

const NO_NOTES: Note[] = [];
const NO_WORDS: number[] = [];
/** Font scale bounds — below 0.8 is unreadable, above 1.6 fits three words a line. */
const FONT_SCALE_MIN = 0.8;
const FONT_SCALE_MAX = 1.6;
const FONT_SCALE_STEP = 0.1;

/**
 * The tri-lingual reader: book/chapter navigation, verse list, per-verse notes,
 * full-text search, and reading-history recording.
 *
 * @returns The Read tab.
 * @remarks **This route is the composition layer.** It pulls from four feature
 *          slices — bible-reader, notes, verse-history and settings — which no
 *          single feature is allowed to do itself. Feature-Sliced Design puts
 *          that wiring in the route precisely so `bible-reader` never imports
 *          `verse-history`: the reader does not know history exists, the route
 *          does.
 *
 *          "Add to topic" always files the verse under a topic — existing or
 *          created on the spot. The reader never creates a topic-less note, so
 *          nothing new ever lands in the "Walay Topic" group.
 */
export default function ReadScreen() {
  const { translationId } = useActiveTranslation();
  const { books, byId } = useBooks(translationId);
  const { bookId, chapter, setPosition, nextChapter, prevChapter } = useReaderStore();
  const { verses, loading } = useChapter(translationId, bookId, chapter);

  const notes = useNotes();
  const history = useReadingHistory();
  const fontScale = useSettingsStore((s) => s.fontScale);
  const setFontScale = useSettingsStore((s) => s.setFontScale);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addingVerse, setAddingVerse] = useState<number | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);

  // Words highlighted on the selected verse, not yet saved. Tagged with what they
  // belong to, so selecting another verse or switching language derives an empty
  // selection — word #5 in English is not word #5 in Bisaya — without a reset effect.
  const [pending, setPending] = useState<{ key: string; words: number[] }>({
    key: '',
    words: NO_WORDS,
  });
  const selectionKey =
    selectedVerse == null ? '' : `${translationId}:${bookId}:${chapter}:${selectedVerse}`;
  const pendingWords = pending.key === selectionKey ? pending.words : NO_WORDS;

  const book = byId.get(bookId);
  const atFirstChapter = chapter <= 1;
  const atLastChapter = book ? chapter >= book.ChapterCount : false;

  // Which verses in this chapter carry notes — one query, not one per verse.
  const notesLoader = useCallback(
    () => notes.forChapter(bookId, chapter),
    [notes, bookId, chapter],
  );
  const { data: chapterNotes, reload: reloadNotes } = useAsyncData<Note[]>(
    notesLoader,
    NO_NOTES,
  );

  useFocusEffect(reloadNotes);
  
  const notedVerses = new Set(chapterNotes.map((note) => note.VerseStart));

  /**
   * Records a chapter view in the reading history, once per chapter per day
   * per app session.
   *
   * @remarks The `Set` is the dedupe. Without it, paging back and forth between
   *          two chapters would log a "reading" every time and inflate the
   *          calendar into meaninglessness. It is a ref, not state, because
   *          recording must never trigger a re-render — the user is reading.
   *
   *          Keyed by day as well as reference, so tomorrow's visit to the same
   *          chapter is correctly a new entry.
   */
  const recorded = useRef(new Set<string>());
  useEffect(() => {
    if (translationId == null || verses.length === 0) return;

    const key = `${bookId}:${chapter}:${toLocalDay()}`;
    if (recorded.current.has(key)) return;
    recorded.current.add(key);

    void history.record({ bookId, chapter, translationId });
  }, [history, translationId, bookId, chapter, verses.length]);

  function adjustFontScale(delta: number) {
    const next = Math.round((fontScale + delta) * 10) / 10;
    setFontScale(Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, next)));
  }

  function jumpTo(nextBookId: number, nextChapter: number) {
    setPosition(nextBookId, nextChapter);
    setSelectedVerse(null);
    setPickerOpen(false);
  }

  return (
    <Screen>
      <View className="border-b border-neutral-200 px-5 pb-3 dark:border-neutral-800">
        <View className="mb-3 flex-row items-center justify-between">
          <Pressable
            onPress={() => setPickerOpen(true)}
            className="flex-row items-center gap-1.5">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
              {book?.Name ?? 'Loading'} {chapter}
            </Text>
            <Text className="text-base text-brand-500">▾</Text>
          </Pressable>

          <View className="flex-row items-center gap-1">
            <Pressable onPress={() => adjustFontScale(-FONT_SCALE_STEP)} className="px-2 py-1">
              <Text className="text-sm font-bold text-neutral-400">A−</Text>
            </Pressable>
            <Pressable onPress={() => adjustFontScale(FONT_SCALE_STEP)} className="px-2 py-1">
              <Text className="text-lg font-bold text-neutral-600 dark:text-neutral-300">
                A+
              </Text>
            </Pressable>
            <Pressable onPress={() => setSearchOpen(true)} className="pl-2">
              <Text className="text-xl">🔍</Text>
            </Pressable>
          </View>
        </View>

        <TranslationSwitcher />
      </View>

      {loading ? (
        <View className="py-12">
          <ActivityIndicator color="#208aef" />
        </View>
      ) : (
        <FlatList
          data={verses}
          // Rows read selection and highlight state from outside `data`.
          extraData={pending}
          keyExtractor={(verse) => String(verse.Id)}
          contentContainerClassName="px-5 pb-24 pt-4"
          ListEmptyComponent={
            <EmptyState
              emoji="📭"
              title="No text for this chapter yet"
              subtitle="Book and chapter navigation works, but the verse text for this translation has not been imported. Load it with importTranslation() — see src/core/db/seed/importVerses.ts."
            />
          }
          renderItem={({ item }) => {
            const isSelected = selectedVerse === item.Verse;
            return (
              <View>
                <Pressable
                  onPress={() => setSelectedVerse(isSelected ? null : item.Verse)}
                  className={`-mx-2 rounded-xl px-2 py-1.5 ${
                    isSelected ? 'bg-brand-50 dark:bg-brand-900/30' : ''
                  }`}>
                  <Text
                    style={{ fontSize: 17 * fontScale, lineHeight: 28 * fontScale }}
                    className="text-neutral-800 dark:text-neutral-200">
                    <Text className="font-bold text-brand-500">{item.Verse} </Text>
                    {isSelected ? (
                      // Selected verse: each word is tappable to highlight it.
                      <HighlightableText
                        text={item.Text}
                        highlighted={pendingWords}
                        onToggleWord={(w) =>
                          setPending({ key: selectionKey, words: toggleWord(pendingWords, w) })
                        }
                      />
                    ) : (
                      item.Text
                    )}
                    {notedVerses.has(item.Verse) ? (
                      <Text className="text-brand-400"> 📝</Text>
                    ) : null}
                  </Text>
                </Pressable>

                {isSelected ? (
                  <View className="mb-2 mt-1">
                    <Text className="mb-2 text-xs text-neutral-500">
                      {pendingWords.length > 0
                        ? `🖍 ${pendingWords.length} ${pendingWords.length === 1 ? 'word' : 'words'} highlighted`
                        : 'Tap words to highlight them before adding.'}
                    </Text>
                    <View className="flex-row">
                      <AppButton
                        label="Add to topic"
                        variant="secondary"
                        onPress={() => setAddingVerse(item.Verse)}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <View className="absolute bottom-4 left-5 right-5 flex-row items-center justify-between rounded-2xl bg-neutral-100/95 px-3 py-2 dark:bg-neutral-900/95">
        <Pressable
          onPress={() => {
            prevChapter();
            setSelectedVerse(null);
          }}
          disabled={atFirstChapter}
          className={`px-4 py-2 ${atFirstChapter ? 'opacity-30' : ''}`}>
          <Text className="text-base font-semibold text-brand-500">‹ Prev</Text>
        </Pressable>

        <Text className="text-sm font-medium text-neutral-500">
          Chapter {chapter}
          {book ? ` of ${book.ChapterCount}` : ''}
        </Text>

        <Pressable
          onPress={() => {
            nextChapter();
            setSelectedVerse(null);
          }}
          disabled={atLastChapter}
          className={`px-4 py-2 ${atLastChapter ? 'opacity-30' : ''}`}>
          <Text className="text-base font-semibold text-brand-500">Next ›</Text>
        </Pressable>
      </View>

      <BookPickerModal
        visible={pickerOpen}
        books={books}
        onSelect={jumpTo}
        onClose={() => setPickerOpen(false)}
      />

      {searchOpen ? (
        <SearchModal
          booksById={byId}
          onSelect={jumpTo}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}

      {addingVerse != null ? (
        <TopicPickerModal
          verse={{ bookId, chapter, verse: addingVerse }}
          verseLabel={formatReference(book?.Name ?? `Book ${bookId}`, chapter, addingVerse)}
          translationId={translationId}
          highlights={addingVerse === selectedVerse ? pendingWords : NO_WORDS}
          bookName={(id) => byId.get(id)?.Name ?? `Book ${id}`}
          onClose={() => setAddingVerse(null)}
          onAdded={() => {
            reloadNotes();
            setPending({ key: '', words: NO_WORDS });
          }}
        />
      ) : null}
    </Screen>
  );
}
