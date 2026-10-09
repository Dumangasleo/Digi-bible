import adb from '@/assets/bible/adb.verses.json';
import ceb from '@/assets/bible/ceb.verses.json';
import kjv from '@/assets/bible/kjv.verses.json';
import { type ImportVerse, type TranslationPayload } from './importVerses';

export const BUNDLED_TRANSLATIONS: TranslationPayload[] = [
  { code: 'KJV', verses: kjv as ImportVerse[] },
  { code: 'ADB', verses: adb as ImportVerse[] },
  { code: 'CEB', verses: ceb as ImportVerse[] },
];