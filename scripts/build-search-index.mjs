/**
 * Build-time script to generate search indexes for psalms.
 * Generates:
 * - public/search/psalms-meta.json  (small, always loaded - number, title, tags)
 * - public/search/verses-index.json (larger, lazy-loaded - MiniSearch index of verse text)
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import MiniSearch from 'minisearch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PSALMS_DIR = join(__dirname, '..', 'src', 'lib', 'data', 'psalms');
const OUTPUT_DIR = join(__dirname, '..', 'public', 'search');

async function loadPsalms() {
  const files = await readdir(PSALMS_DIR);
  const psalmFiles = files.filter(f => f.endsWith('.json'));
  
  const psalms = [];
  for (const file of psalmFiles) {
    const content = await readFile(join(PSALMS_DIR, file), 'utf-8');
    psalms.push(JSON.parse(content));
  }
  
  // Sort by number
  psalms.sort((a, b) => a.number - b.number);
  return psalms;
}

function buildMetaIndex(psalms) {
  return psalms.map(p => ({
    id: p.id,
    number: p.number,
    title: p.title,
    tags: p.tags || [],
  }));
}

function buildVersesIndex(psalms) {
  // Create MiniSearch index for verse text search
  const miniSearch = new MiniSearch({
    fields: ['text'],        // searchable field
    storeFields: ['psalmId', 'psalmNumber'], // fields to return with results
    idField: 'docId',
  });
  
  // Create documents: one per psalm with all verses combined
  const documents = psalms.map(psalm => {
    // Combine all verse syllables into searchable text
    const allText = psalm.verses
      .flatMap(v => v.syllables || v.lines || [])
      .flat()
      .filter(s => s && s !== '_')
      .join(' ');
    
    return {
      docId: psalm.id,
      psalmId: psalm.id,
      psalmNumber: psalm.number,
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
  
  // Load all psalms
  const psalms = await loadPsalms();
  console.log(`Loaded ${psalms.length} psalms`);
  
  // Build and write metadata index (always loaded)
  const meta = buildMetaIndex(psalms);
  const metaPath = join(OUTPUT_DIR, 'psalms-meta.json');
  await writeFile(metaPath, JSON.stringify(meta, null, 2));
  console.log(`Wrote ${metaPath}`);
  
  // Build and write verses index (lazy loaded)
  const versesIndex = buildVersesIndex(psalms);
  const versesPath = join(OUTPUT_DIR, 'verses-index.json');
  await writeFile(versesPath, versesIndex);
  console.log(`Wrote ${versesPath}`);
  
  console.log('Search indexes built successfully!');
}

main().catch(err => {
  console.error('Error building search indexes:', err);
  process.exit(1);
});
