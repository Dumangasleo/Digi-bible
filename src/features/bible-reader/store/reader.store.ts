import { create } from 'zustand';

interface ReaderState {
  /** Current book id (canonical 1..66). Defaults to John. */
  bookId: number;
  chapter: number;
  setPosition: (bookId: number, chapter: number) => void;
  goToChapter: (chapter: number) => void;
  nextChapter: () => void;
  prevChapter: () => void;
}

/**
 * Ephemeral reader position (which book/chapter is on screen). Lives in the
 * feature, not global settings — it's transient navigation state, not a
 * durable preference.
 */
export const useReaderStore = create<ReaderState>((set) => ({
  bookId: 43, // John — a friendly default landing spot
  chapter: 1,
  setPosition: (bookId, chapter) => set({ bookId, chapter }),
  goToChapter: (chapter) => set({ chapter: Math.max(1, chapter) }),
  nextChapter: () => set((s) => ({ chapter: s.chapter + 1 })),
  prevChapter: () => set((s) => ({ chapter: Math.max(1, s.chapter - 1) })),
}));
