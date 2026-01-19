/**
 * Build-time script to generate search indexes for all songs (psalms, gezangen, etc.).
 * Generates:
 * - public/search/songs-meta.json   (small, always loaded - number, title, category, tags)
 * - public/search/verses-index.json (larger, lazy-loaded - MiniSearch index of verse text)
 * - public/search/categories.json   (list of available categories)
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import MiniSearch from 'minisearch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'lib', 'data');
const OUTPUT_DIR = join(__dirname, '..', 'public', 'search');

// Category display names
const categoryDisplayNames = {
  psalm: 'Psalms',
  psalms: 'Psalms',
  gezang: 'Gezangen',
  gezangen: 'Gezangen',
};

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function discoverCategories() {
  const entries = await readdir(DATA_DIR, { withFileTypes: true });
  const categories = [];
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Check if directory contains JSON files
      const dirPath = join(DATA_DIR, entry.name);
      const files = await readdir(dirPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      if (jsonFiles.length > 0) {
        categories.push({
          id: entry.name,
          name: categoryDisplayNames[entry.name] || capitalizeFirst(entry.name),
          count: jsonFiles.length,
        });
      }
    }
  }
  
  // Sort: psalms first, then alphabetically
  return categories.sort((a, b) => {
    if (a.id === 'psalm' || a.id === 'psalms') return -1;
    if (b.id === 'psalm' || b.id === 'psalms') return 1;
    return a.name.localeCompare(b.name);
  });
}

async function loadAllSongs(categories) {
  const songs = [];
  
  for (const category of categories) {
    const categoryDir = join(DATA_DIR, category.id);
    const files = await readdir(categoryDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    for (const file of jsonFiles) {
      const content = await readFile(join(categoryDir, file), 'utf-8');
      const song = JSON.parse(content.replace(/^\uFEFF/, ''));
      // Ensure category is set
      song.category = song.category || category.id;
      songs.push(song);
    }
  }
  
  // Sort by category, then by number
  songs.sort((a, b) => {
    if (a.category !== b.category) {
      // Psalms first
      if (a.category === 'psalms') return -1;
      if (b.category === 'psalms') return 1;
      return a.category.localeCompare(b.category);
    }
    return a.number - b.number;
  });
  
  return songs;
}

function buildMetaIndex(songs) {
  return songs.map(s => ({
    id: s.id,
    number: s.number,
    title: s.title,
    category: s.category,
    tags: s.tags || [],
  }));
}

function normalizeText(s) {
  return (s ?? '')
    .toString()
    .toLowerCase()
    .replace(/[’']/g, "'")
    // Keep letters/numbers/spaces/hyphen; drop punctuation/symbols
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildVersesIndex(songs) {
  // Create MiniSearch index for verse text search
  const miniSearch = new MiniSearch({
    fields: ['text'],        // searchable field
    // Include `text` so the client can do exact phrase filtering when user uses quotes.
    storeFields: ['songId', 'songNumber', 'category', 'text'],
    idField: 'docId',
  });
  
  // Create documents: one per song with all verses combined
  const documents = songs.map(song => {
    // Combine all verse lines into searchable text (use lines, not syllables, to keep words intact)
    const allTextRaw = song.verses
      .flatMap(v => v.lines)
      .join(' ');

    const allText = normalizeText(allTextRaw);
    
    return {
      docId: song.id,
      songId: song.id,
      songNumber: song.number,
      category: song.category,
      text: allText,
    };
  });
  
  miniSearch.addAll(documents);
  
  return JSON.stringify(miniSearch);
}

async function main() {
  console.log('Building search indexes...');
  
  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });
  
  // Discover categories
  const categories = await discoverCategories();
  console.log(`Found ${categories.length} categories: ${categories.map(c => c.name).join(', ')}`);
  
  // Load all songs from all categories
  const songs = await loadAllSongs(categories);
  console.log(`Loaded ${songs.length} songs total`);
  
  // Write categories index
  const categoriesPath = join(OUTPUT_DIR, 'categories.json');
  await writeFile(categoriesPath, JSON.stringify(categories, null, 2));
  console.log(`Wrote ${categoriesPath}`);
  
  // Build and write metadata index (always loaded)
  const meta = buildMetaIndex(songs);
  const metaPath = join(OUTPUT_DIR, 'songs-meta.json');
  await writeFile(metaPath, JSON.stringify(meta, null, 2));
  console.log(`Wrote ${metaPath}`);
  
  // Build and write verses index (lazy loaded)
  const versesIndex = buildVersesIndex(songs);
  const versesPath = join(OUTPUT_DIR, 'verses-index.json');
  await writeFile(versesPath, versesIndex);
  console.log(`Wrote ${versesPath}`);
  
  console.log('Search indexes built successfully!');
}

main().catch(err => {
  console.error('Error building search indexes:', err);
  process.exit(1);
});
