# Psalm Melodies - Data Layer Guide

## OVERVIEW
Massive dataset of 150+ Dutch psalms and hymns (gezangen) pre-computed for VexFlow and transposition.

## STRUCTURE
- `psalmen/`: 150+ JSON files (psalm-1.json to psalm-150.json) following the `PsalmData` schema.
- `gezangen/`: Additional hymns (e.g., "Gezang 1") stored in a separate category folder.
- `songs.ts`: Central loader using Vite `import.meta.glob` for category discovery and song indexing.
- `index.ts`: Public barrel export for the data layer.

## WHERE TO LOOK
| Component | Location | Role |
|-----------|----------|------|
| Raw Psalm Data | `psalmen/*.json` | Measures, notes, and syllabified verses |
| Data Loader | `songs.ts` | Vite glob importing and search/filter functions |
| Verse Index | `scripts/build-search-index.mjs` | Build-time MiniSearch index generation |
| Data Schema | `src/lib/types/music.ts` | `PsalmData` and `VerseLyrics` interfaces |

## DATA PIPELINE & CONSTRAINTS
- **Generation**: Data is produced via `generate-psalms.ps1` (root). Never edit JSON files manually.
- **Syllabification**: `verses[v].syllables[line]` must align perfectly with `melody.measures[line].notes`.
- **Note Format**: Notes use VexFlow syntax (e.g., `"a/4"`) and specific duration codes (`"h"`, `"q"`).
- **Categorization**: Folders in `src/lib/data/` are automatically treated as categories (e.g., `psalmen`, `gezangen`).
- **Search**: All text in `lines` is indexed into `public/search/` at build time for high-performance mobile search.

## ANTI-PATTERNS
- NEVER manually edit psalm JSON files; the syllabification logic is fragile and script-managed.
- NO hardcoded psalm counts or IDs; use `getSongsByCategory()` or `getCategories()`.
- DON'T bypass `songs.ts`; it ensures consistent category mapping and song sorting.
- AVOID adding large metadata to JSON; keep files focused on musical notation and lyrics.
