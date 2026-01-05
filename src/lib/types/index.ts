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
