import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo } from 'react';

import { useAsyncData } from '@/shared/hooks/useAsyncData';

import { bibleService } from '../services/bible.service';
import { type Book } from '../types';

const NO_BOOKS: Book[] = [];

/**
 * The 66 books, name-localized to a translation, plus an id lookup.
 *
 * @param translationId - `Translations.Id`, or `null` while it is still resolving.
 * @returns `{ books, byId, loading }`. `byId` maps canonical id → book.
 * @remarks Notes, history and the reader all need to turn a stored `BookId` into
 *          a display name. Doing that with `books.find()` per row is O(n) per
 *          item; the `Map` makes it O(1) and is rebuilt only when the book list
 *          itself changes.
 *
 *          A `null` `translationId` resolves to an empty list rather than
 *          throwing — the caller renders a normal loading state instead of
 *          needing a separate guard.
 */
export function useBooks(translationId: number | null) {
  const db = useSQLiteContext();

  const loader = useCallback(
    () => (translationId == null ? Promise.resolve(NO_BOOKS) : bibleService.listBooks(db, translationId)),
    [db, translationId],
  );
  const { data: books, loading } = useAsyncData<Book[]>(loader, NO_BOOKS);

  const byId = useMemo(() => new Map(books.map((b) => [b.Id, b])), [books]);

  return { books, byId, loading };
}
