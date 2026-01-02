/**
 * Psalm data loader
 * Loads psalms from individual JSON files using Vite's glob import
 */

import type { PsalmData } from '../types/music';

// Import all psalm JSON files using Vite's glob import (eager loading)
const psalmModules = import.meta.glob<{ default: PsalmData }>(
  './psalms/psalm-*.json',
  { eager: true }
);

// Extract and collect all psalms, sorted by number
export const psalms: PsalmData[] = Object.values(psalmModules)
  .map(module => module.default as PsalmData)
  .sort((a, b) => a.number - b.number);

/**
 * Get a psalm by its ID
 */
export function getPsalmById(id: string): PsalmData | undefined {
  return psalms.find(p => p.id === id);
}

/**
 * Get a psalm by its number
 */
export function getPsalmByNumber(num: number): PsalmData | undefined {
  return psalms.find(p => p.number === num);
}

/**
 * Search psalms by text in title or verses
 */
export function searchPsalms(query: string): PsalmData[] {
  const lowerQuery = query.toLowerCase();
  
  return psalms.filter(psalm => {
    // Search in title
    if (psalm.title.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    // Search in psalm number
    if (psalm.number.toString().includes(query)) {
      return true;
    }
    
    // Search in verse lyrics
    return psalm.verses.some(verse =>
      verse.lines.some(line => 
        line.toLowerCase().includes(lowerQuery)
      )
    );
  });
}

/**
 * Get all notes from a psalm melody (flattened from measures)
 */
export function getMelodyNotes(psalm: PsalmData) {
  if (!psalm.melody?.measures) return [];
  return psalm.melody.measures.flatMap(measure => measure.notes);
}
