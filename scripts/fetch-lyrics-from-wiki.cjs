#!/usr/bin/env node

/**
 * Fetch lyrics from Kerkliedwiki (MediaWiki API)
 * Usage: node fetch-lyrics-from-wiki.cjs "Lichtstad_met_uw_paarlen_poorten"
 */

const https = require('https');

const API_BASE = 'https://kerkliedwiki.nl/api.php';

/**
 * Fetch page content from MediaWiki API
 */
async function fetchPage(pageName) {
  const url = `${API_BASE}?action=query&prop=revisions&rvprop=content&rvslots=*&format=json&titles=${encodeURIComponent(pageName)}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query?.pages || {};
          const pageId = Object.keys(pages).find(id => id !== '-1');

          if (pageId && pages[pageId]?.revisions?.[0]?.slots?.main?.['*']) {
            resolve(pages[pageId].revisions[0].slots.main['*']);
          } else {
            reject(new Error('Page not found or no content'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Parse MediaWiki wikitext and extract verses
 */
async function parseLyrics(wikitext) {
  const title = 'Unknown';
  const verses = [];
  let chorus = null;

  console.log('Parsing wikitext...');

  // Split content by === Section headers ===
  const sections = wikitext.split(/^={3}\s*([^=]+)\s*={3}$/gm);

  for (let i = 1; i < sections.length; i += 2) {
    const sectionTitle = sections[i].trim();
    const sectionContent = sections[i + 1] || '';

    // Check for chorus sections (Koor, Refrein)
    if (/^koor$/i.test(sectionTitle) || /^refrein$/i.test(sectionTitle)) {
      const lines = extractLines(sectionContent);
      if (lines.length > 0) {
        chorus = lines;
      }
      continue;
    }

    // Check for numbered verses
    const verseMatch = sectionTitle.match(/^(\d+)/);
    if (verseMatch) {
      const verseNum = parseInt(verseMatch[1], 10);
      const lines = extractLines(sectionContent);
      if (lines.length > 0) {
        verses.push({ number: verseNum, lines });
      }
    }
  }

  // Fallback: if no sections found, try to parse all numbered lines
  if (verses.length === 0) {
    console.log('No sections found, trying numbered lines...');
    const allLines = wikitext.split('\n');
    let currentVerse = null;

    for (const line of allLines) {
      const verseMatch = line.match(/^(\d+)\.\s*/);
      if (verseMatch) {
        if (currentVerse) {
          verses.push(currentVerse);
        }
        currentVerse = { number: parseInt(verseMatch[1], 10), lines: [] };
      } else if (currentVerse && line.trim() && !line.startsWith('=')) {
        currentVerse.lines.push(line.trim());
      }
    }
    if (currentVerse) {
      verses.push(currentVerse);
    }
  }

  console.log(`Found ${verses.length} verses`);
  return { title, verses, chorus };
}

/**
 * Extract lines from wikitext
 */
function extractLines(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      // Skip empty lines, wiki markup, and headings
      if (!line) return false;
      if (line.startsWith('=')) return false;
      if (line.startsWith('[') && line.includes(':')) return false;
      if (line.startsWith('{{') || line.startsWith('}}')) return false;
      if (line.startsWith('|')) return false;
      if (line.startsWith('*') || line.startsWith('#') || line.startsWith(';')) return false;
      return true;
    });
}

/**
 * Main execution
 */
async function main() {
  const pageName = process.argv[2];

  if (!pageName) {
    console.error('Usage: node fetch-lyrics-from-wiki.cjs "Page_Name"');
    console.error('Example: node fetch-lyrics-from-wiki.cjs "Lichtstad_met_uw_paarlen_poorten"');
    process.exit(1);
  }

  try {
    console.log(`Fetching lyrics for: ${pageName}`);
    const wikitext = await fetchPage(pageName);
    console.log('Wikitext received, parsing...');
    const lyrics = await parseLyrics(wikitext);

    console.log(JSON.stringify(lyrics, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main();