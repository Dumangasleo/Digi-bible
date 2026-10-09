import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useSettingsStore } from '@/store/settings.store';

import { bibleService } from '../services/bible.service';
import { type Translation } from '../types';

/**
 * Resolves the user's chosen translation *code* to its database row.
 *
 * @returns `{ translation, translationId, loading }`. `translationId` is `null`
 *          until the lookup resolves — callers must not query with it before then.
 * @remarks The settings store persists a stable code ('KJV'), never the numeric
 *          `Translations.Id`. AUTOINCREMENT ids are an implementation detail that
 *          can shift if the seed is ever re-run; persisting one to AsyncStorage
 *          would mean a user's saved preference silently pointing at a different
 *          Bible. This hook is the single place that bridges the two.
 */
export function useActiveTranslation() {
  const db = useSQLiteContext();
  const code = useSettingsStore((s) => s.translationCode);

  const loader = useCallback(
    () => bibleService.getTranslationByCode(db, code),
    [db, code],
  );
  const { data, loading } = useAsyncData<Translation | null>(loader, null);

  return { translation: data, translationId: data?.Id ?? null, loading };
}
