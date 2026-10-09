/**
 * Localized short book names for the Tagalog (ADB) and Bisaya (CEB) translations.
 *
 * Index 0 is Genesis (book id 1) and index 65 is Revelation (book id 66) — the
 * same canonical order as `CANON` in canon.ts. English names are not here; they
 * come from `CANON` and are seeded with the translations.
 *
 * **This file is the one place to fix a name.** Edit the string, then push an
 * update: `seedBookNames` compares these lists against the database on every
 * launch and rewrites only the names that differ, so a correction reaches
 * existing installs without a migration or a reinstall.
 *
 * Sourcing: the public-domain digital editions of ADB 1905 and Cebuano
 * Pinadayag carry book *codes* only (e.g. `osisID='Gen'`), no localized titles.
 * These are the standard short names, cross-checked against the verse text
 * where a verse names its own book — ADB Luke 20:42 "aklat ng Mga Awit",
 * CEB Luke 20:42 "Basahon sa mga Salmos", both Luke 4:17 "Isaias".
 *
 * Short style by choice: "Efeso", not "Mga Taga-Efeso", to fit headers and cards.
 * "Mga" is kept only where it is part of the name itself ("Mga Bilang" — without
 * it, "Bilang" just means "number"; "Mga Hukom", "Mga Gawa", "Mga Buhat").
 */
export const LOCALIZED_BOOK_NAMES: Record<'ADB' | 'CEB', readonly string[]> = {
  ADB: [
    // ── Old Testament ──
    'Genesis', 'Exodo', 'Levitico', 'Mga Bilang', 'Deuteronomio',
    'Josue', 'Mga Hukom', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Mga Hari', '2 Mga Hari', '1 Cronica', '2 Cronica', 'Ezra',
    'Nehemias', 'Ester', 'Job', 'Mga Awit', 'Mga Kawikaan',
    'Mangangaral', 'Awit ng mga Awit', 'Isaias', 'Jeremias', 'Mga Panaghoy',
    'Ezekiel', 'Daniel', 'Oseas', 'Joel', 'Amos',
    'Obadias', 'Jonas', 'Mikas', 'Nahum', 'Habacuc',
    'Sofonias', 'Hageo', 'Zacarias', 'Malakias',
    // ── New Testament ──
    'Mateo', 'Marcos', 'Lucas', 'Juan', 'Mga Gawa',
    'Roma', '1 Corinto', '2 Corinto', 'Galacia', 'Efeso',
    'Filipos', 'Colosas', '1 Tesalonica', '2 Tesalonica', '1 Timoteo',
    '2 Timoteo', 'Tito', 'Filemon', 'Hebreo', 'Santiago',
    '1 Pedro', '2 Pedro', '1 Juan', '2 Juan', '3 Juan',
    'Judas', 'Apocalipsis',
  ],
  CEB: [
    // ── Old Testament ──
    'Genesis', 'Exodo', 'Levitico', 'Numeros', 'Deuteronomio',
    'Josue', 'Mga Maghuhukom', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Mga Hari', '2 Mga Hari', '1 Cronicas', '2 Cronicas', 'Esdras',
    'Nehemias', 'Ester', 'Job', 'Mga Salmos', 'Mga Proverbio',
    'Ecclesiastes', 'Awit ni Solomon', 'Isaias', 'Jeremias', 'Mga Lamentaciones',
    'Ezequiel', 'Daniel', 'Oseas', 'Joel', 'Amos',
    'Abdias', 'Jonas', 'Miqueas', 'Nahum', 'Habacuc',
    'Sofonias', 'Hageo', 'Zacarias', 'Malaquias',
    // ── New Testament ──
    'Mateo', 'Marcos', 'Lucas', 'Juan', 'Mga Buhat',
    'Roma', '1 Corinto', '2 Corinto', 'Galacia', 'Efeso',
    'Filipos', 'Colosas', '1 Tesalonica', '2 Tesalonica', '1 Timoteo',
    '2 Timoteo', 'Tito', 'Filemon', 'Hebreohanon', 'Santiago',
    '1 Pedro', '2 Pedro', '1 Juan', '2 Juan', '3 Juan',
    'Judas', 'Pinadayag',
  ],
};
