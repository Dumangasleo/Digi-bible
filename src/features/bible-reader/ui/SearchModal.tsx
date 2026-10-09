import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/shared/ui/EmptyState';
import { formatReference } from '@/shared/utils/reference';

import { type TranslationCode } from '@/store/settings.store';

import { bibleService } from '../services/bible.service';
import { type Book, type SearchHit } from '../types';
import { TRANSLATION_LABELS } from './TranslationSwitcher';

/** Milliseconds of quiet typing before a query fires. */
const DEBOUNCE_MS = 250;
/** Shorter than this matches most of the Bible and is not worth querying. */
const MIN_QUERY_LENGTH = 2;

const NO_HITS: SearchHit[] = [];

interface SearchModalProps {
  /** Canonical id → book, for turning a hit's `BookId` into a reference label. */
  booksById: Map<number, Book>;
  /** Receives the hit's verse too; callers that only navigate can ignore it. */
  onSelect: (bookId: number, chapter: number, verse: number) => void;
  onClose: () => void;
}

/**
 * Full-text verse search across English, Tagalog and Bisaya at once.
 *
 * @param booksById - Lookup for rendering references.
 * @param onSelect - Called with `(bookId, chapter, verse)` for the tapped hit. The
 *                   reader uses only the first two to navigate; the topic screens
 *                   use all three to file that exact verse.
 * @param onClose - Dismiss handler.
 * @returns The search modal.
 * @remarks **Mounted only while open** — the parent renders it conditionally.
 *          That is what resets the query and results between openings: unmounting
 *          drops the state for free, where a "clear everything when `visible`
 *          turns false" effect would be an extra render pass and a second source
 *          of truth for whether the sheet is open.
 *
 *          **Debounced, and the debounce is the point.** Querying on every
 *          keystroke means one FTS scan per character while the user is still
 *          mid-word. The timer is cleared in the effect's cleanup, so only the
 *          final pause actually queries.
 *
 *          Results are tagged with the query that produced them, and both
 *          `results` and `searching` are *derived* from comparing that tag to
 *          what is currently typed. This makes stale results structurally
 *          impossible: a slow query for "lo" resolving after "love" was typed
 *          simply fails the tag check and is never shown.
 *
 *          Not tied to the reading translation: each hit carries the language it
 *          matched in and is labelled with it, so "pagtoo" finds Bisaya verses
 *          even while you are reading in English.
 */
export function SearchModal({ booksById, onSelect, onClose }: SearchModalProps) {
  const db = useSQLiteContext();
  const [query, setQuery] = useState('');
  const [settled, setSettled] = useState<{ forQuery: string; hits: SearchHit[] }>({
    forQuery: '',
    hits: NO_HITS,
  });

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_QUERY_LENGTH;

  useEffect(() => {
    if (tooShort) return;

    let active = true;
    const timer = setTimeout(() => {
      bibleService.search(db, trimmed).then((hits) => {
        if (active) setSettled({ forQuery: trimmed, hits });
      });
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [db, trimmed, tooShort]);

  const isCurrent = settled.forQuery === trimmed;
  const results = !tooShort && isCurrent ? settled.hits : NO_HITS;
  const searching = !tooShort && !isCurrent;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top']}>
        <View className="flex-row items-center gap-3 border-b border-neutral-200 px-5 pb-3 dark:border-neutral-800">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search in English, Tagalog or Bisaya"
            placeholderTextColor="#a3a3a3"
            autoFocus
            className="flex-1 rounded-2xl bg-neutral-100 px-4 py-2.5 text-base text-neutral-900 dark:bg-neutral-900 dark:text-white"
          />
          <Pressable onPress={onClose}>
            <Text className="text-base font-medium text-brand-500">Done</Text>
          </Pressable>
        </View>

        {searching ? (
          <View className="py-8">
            <ActivityIndicator color="#208aef" />
          </View>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(verse) => String(verse.Id)}
          contentContainerClassName="px-5 pb-10"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searching ? null : tooShort ? (
              <EmptyState
                emoji="🔎"
                title="Search every verse"
                subtitle="Type at least two characters, in any of the three languages — e.g. faith, pananampalataya, or pagtoo. Results ignore accents."
              />
            ) : (
              <EmptyState
                emoji="🔍"
                title="No matches"
                subtitle={`Nothing found for "${trimmed}" in English, Tagalog or Bisaya.`}
              />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onSelect(item.BookId, item.Chapter, item.Verse);
                onClose();
              }}
              className="border-b border-neutral-100 py-4 dark:border-neutral-900">
              <View className="mb-1 flex-row items-center gap-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-brand-500">
                  {formatReference(
                    booksById.get(item.BookId)?.Name ?? `Book ${item.BookId}`,
                    item.Chapter,
                    item.Verse,
                  )}
                </Text>
                {/* Which language this hit matched in — the text below is in it. */}
                <View className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                  <Text className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
                    {TRANSLATION_LABELS[item.TranslationCode as TranslationCode] ??
                      item.TranslationCode}
                  </Text>
                </View>
              </View>
              <Text
                numberOfLines={3}
                className="text-base leading-6 text-neutral-800 dark:text-neutral-200">
                {item.Text}
              </Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
