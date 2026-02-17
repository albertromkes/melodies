/**
 * Songs data loader
 * Loads songs from multiple category folders using Vite's glob import
 * Each subfolder in ./data/ is treated as a category
 */

import type { PsalmData } from '../types/music';
import type { Category } from '../types';

// Import all JSON files from all category folders using Vite's glob import
// This pattern matches: ./psalms/*.json, ./gezangen/*.json, etc.
const songModules = import.meta.glob<{ default: PsalmData }>(
  ['./*/*.json', '!./index.ts', '!./psalms.ts', '!./songs.ts'],
  { eager: true }
);

const CATEGORY_ALIASES: Record<string, string> = {
  psalm: 'psalmen',
  psalms: 'psalmen',
  psalmen: 'psalmen',
  gezang: 'gezangen',
  gezangen: 'gezangen',
};

// Category display names (GUI is Dutch)
const categoryDisplayNames: Record<string, string> = {
  psalmen: 'Psalmen',
  gezangen: 'Gezangen',
};

function normalizeCategoryId(categoryId: string | undefined): string {
  if (!categoryId) return 'unknown';
  const normalized = categoryId.toLowerCase();
  return CATEGORY_ALIASES[normalized] ?? normalized;
}

function isPsalmenCategory(categoryId: string): boolean {
  return normalizeCategoryId(categoryId) === 'psalmen';
}

// Extract category from file path (e.g., './psalms/psalm-1.json' -> 'psalms')
function getCategoryFromPath(path: string): string {
  const match = path.match(/^\.\/([^/]+)\//);
  return normalizeCategoryId(match ? match[1] : 'unknown');
}

// Collect all songs with their categories
interface SongWithCategory extends PsalmData {
  category: string;
}

const allSongsRaw: SongWithCategory[] = Object.entries(songModules)
  .map(([path, module]) => {
    const song = module.default as PsalmData;
    const folderCategory = getCategoryFromPath(path);
    return {
      ...song,
      // Always use folder name as category for consistency
      category: normalizeCategoryId(folderCategory),
    };
  })
  .sort((a, b) => {
    // Sort by category first, then by number
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.number - b.number;
  });

/** All songs from all categories */
export const allSongs: PsalmData[] = allSongsRaw;

/** Get all available categories with counts */
export function getCategories(): Category[] {
  const categoryCounts = new Map<string, number>();
  
  allSongsRaw.forEach(song => {
    const count = categoryCounts.get(song.category) || 0;
    categoryCounts.set(song.category, count + 1);
  });
  
  return Array.from(categoryCounts.entries())
    .map(([id, count]) => ({
      id,
      name: categoryDisplayNames[id] || capitalizeFirst(id),
      count,
    }))
    .sort((a, b) => {
      // Psalmen always first
      if (isPsalmenCategory(a.id) && !isPsalmenCategory(b.id)) return -1;
      if (isPsalmenCategory(b.id) && !isPsalmenCategory(a.id)) return 1;
      return a.name.localeCompare(b.name);
    });
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Get songs by category */
export function getSongsByCategory(categoryId: string): PsalmData[] {
  const normalizedCategoryId = normalizeCategoryId(categoryId);
  return allSongsRaw
    .filter(song => song.category === normalizedCategoryId)
    .sort((a, b) => a.number - b.number);
}

/** Get a song by its ID (searches all categories) */
export function getSongById(id: string): PsalmData | undefined {
  return allSongsRaw.find(s => s.id === id);
}

/** Get a song by number and category */
export function getSongByNumber(num: number, categoryId?: string): PsalmData | undefined {
  const normalizedCategoryId = categoryId ? normalizeCategoryId(categoryId) : undefined;
  if (categoryId) {
    return allSongsRaw.find(s => s.number === num && s.category === normalizedCategoryId);
  }
  return allSongsRaw.find(s => s.number === num);
}

/**
 * Get all notes from a song melody (flattened from measures)
 */
export function getMelodyNotes(song: PsalmData) {
  if (!song.melody?.measures) return [];
  return song.melody.measures.flatMap(measure => measure.notes);
}

// Re-export psalms for backward compatibility
export const psalms = getSongsByCategory('psalmen');
