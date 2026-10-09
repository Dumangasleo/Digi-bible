# Digi Bible

An offline, tri-lingual Bible app for Android — **English (KJV), Tagalog (Ang Dating
Biblia 1905) and Bisaya (Cebuano Pinadayag)** — with study topics, verse highlights
and church event reminders. Everything runs on the phone; no account, no server.

## Features

- **Read offline** in three languages, with book names in each language
- **Search** all three translations at once — `faith`, `pananampalataya` or `pagtoo`
- **Study topics** — title, description, the verses that belong to it, and
  description blocks that explain the verses that follow
- **Highlight words** in a verse before adding it to a topic, or later from the topic
- **Reading history** calendar and a **verse of the day**
- **Church schedule** with local reminders

## Tech stack

Expo SDK 57 · React Native · TypeScript · expo-router · SQLite (`expo-sqlite`, FTS5) ·
NativeWind · Zustand · EAS Build + EAS Update

## Getting started

```bash
npm install
npx expo start
```

Open the app on a phone with the **development build** installed (not Expo Go — the app
uses native modules such as SQLite and notifications).

## Project structure

```
src/
├── app/            Screens (expo-router routes) — compose features, no SQL
├── features/       One folder per feature: data/ (SQL) → services/ (rules)
│                   → hooks/ (DB binding) → ui/ (components)
├── core/db/        Migrations, seeding, verse import
└── shared/         Reusable UI, hooks and utilities
scripts/            One-off tools (Bible JSON converter)
assets/bible/       Converted verse files bundled into the app
```

Database tables and columns are **PascalCase**. Schema changes go in a new block in
`src/core/db/migrations.ts` — never edit a block that has already shipped.

## Bible data

The verse files in `assets/bible/*.verses.json` are generated, not hand-written:

1. Download `KJV.json`, `TagAngBiblia.json` and `CebPinadayag.json` from
   [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)
   (`formats/json`) into `assets/bible/`
2. Run `node scripts/convert-bible.mjs`

The raw downloads are git-ignored; only the converted files are committed.

## Releasing

| Change | Command |
|---|---|
| JavaScript / TypeScript only | `eas update --channel preview --platform android --message "..."` |
| Native — new package, icon, splash, `app.json` plugins | `eas build --platform android --profile preview` |

Updates are matched to builds by a **fingerprint** runtime version: an update only
reaches phones whose installed build has the same native code.

## Credits

Bible texts are in the public domain. The app logo belongs to Church of God Members
International and is used for personal use only.
