import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ReaderState {
  /** Current book id (canonical 1..66). Defaults to John on a fresh install. */
  bookId: number;
  chapter: number;
  setPosition: (bookId: number, chapter: number) => void;
  goToChapter: (chapter: number) => void;
  nextChapter: () => void;
  prevChapter: () => void;
}

/**
 * Where the reader is — which book and chapter is on screen — remembered across
 * app restarts.
 *
 * @remarks Persisted to AsyncStorage, the same way as the settings store, so the
 *          app reopens on the chapter you were reading instead of jumping back to
 *          John 1 and making you find your place again. Only `bookId` and
 *          `chapter` are written (`partialize`); the actions are code, not state.
 *
 *          Lives in the feature, not in global settings: it is the reader's own
 *          position, not an app-wide preference.
 */
export const useReaderStore = create<ReaderState>()(
  persist(
    (set) => ({
      bookId: 43, // John — a friendly first landing spot
      chapter: 1,
      setPosition: (bookId, chapter) => set({ bookId, chapter }),
      goToChapter: (chapter) => set({ chapter: Math.max(1, chapter) }),
      nextChapter: () => set((s) => ({ chapter: s.chapter + 1 })),
      prevChapter: () => set((s) => ({ chapter: Math.max(1, s.chapter - 1) })),
    }),
    {
      name: 'smartbible-reader-position',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ bookId: s.bookId, chapter: s.chapter }),
    },
  ),
);
