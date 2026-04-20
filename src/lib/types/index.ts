import type { PsalmData } from './music';

// Types barrel export
export * from './music';

/** Category metadata */
export interface Category {
  /** Folder name (e.g., 'psalms', 'gezangen') */
  id: string;
  /** Display name (e.g., 'Psalms', 'Gezangen') */
  name: string;
  /** Number of songs in this category */
  count: number;
}

/** Song metadata for search index */
export interface SongMeta {
  id: string;
  number: number;
  title: string;
  category: string;
  tags: string[];
}

/** Verse-level preview for a song search result */
export interface SongVerseMatch {
  verseNumber: number;
  snippet: string;
}

/** Song plus verse previews for search results */
export interface SongSearchResult {
  song: PsalmData;
  matchedVerses: SongVerseMatch[];
}

/** Optional selection options when opening a song */
export interface SongSelectionOptions {
  initialVerseNumber?: number;
}
