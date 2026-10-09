import { useCallback, useEffect, useState } from 'react';

export interface AsyncData<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  /** Re-runs the loader. Safe to call from an event handler after a write. */
  reload: () => void;
}

/** What the last settled query produced, tagged with the loader that produced it. */
interface Settled<T> {
  data: T;
  error: Error | null;
  /** The loader identity this result belongs to; `null` before the first settle. */
  source: (() => Promise<T>) | null;
}

/**
 * Runs an async loader and exposes its result, loading flag, and a manual
 * `reload` trigger.
 *
 * @param loader - The async read. **Must be memoized** by the caller (usually
 *                 `useCallback`); an inline arrow would be a new identity every
 *                 render and would re-query in an infinite loop.
 * @param initial - Value held before the first result arrives.
 * @returns `{ data, loading, error, reload }`.
 * @remarks Every local read in this app is "fire a query, render the rows" —
 *          four screens were about to hand-roll the same effect with the same
 *          cancellation flag. That flag is the actual reason this exists:
 *          switching chapters quickly lets a slow earlier query resolve last and
 *          overwrite the newer result on screen.
 *
 *          **`loading` is derived, not stored.** The settled result carries the
 *          loader that produced it, and `loading` is simply "the settled result
 *          is not from the current loader". Setting a loading flag inside the
 *          effect would mean an extra render pass before the query even starts —
 *          the cascading-render pattern the React Compiler rejects.
 *
 *          A consequence worth knowing: `reload()` does not flip `loading` back
 *          to `true`, because the loader identity has not changed. Refreshes are
 *          therefore stale-while-revalidate — the old rows stay on screen until
 *          the new ones land, instead of the list flashing empty after every save.
 *
 *          Errors are captured into state, never swallowed, and the previous
 *          `data` is retained so a failed refresh does not also blank the screen.
 */
export function useAsyncData<T>(loader: () => Promise<T>, initial: T): AsyncData<T> {
  const [settled, setSettled] = useState<Settled<T>>({
    data: initial,
    error: null,
    source: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;

    loader()
      .then((result) => {
        if (active) setSettled({ data: result, error: null, source: loader });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setSettled((previous) => ({
          data: previous.data,
          error: cause instanceof Error ? cause : new Error(String(cause)),
          source: loader,
        }));
      });

    return () => {
      active = false;
    };
  }, [loader, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: settled.data,
    loading: settled.source !== loader,
    error: settled.error,
    reload,
  };
}
