#!/usr/bin/env node

/**
 * Assemble complete Lied JSON files from MusicXML and lyrics
 * Usage: node scripts/assemble-lied.cjs data-raw/liederen-top50.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Load hymn metadata from JSON file
 */
function loadMetadata(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Parse MusicXML file using musicxml-to-notes.cjs
 */
function parseMusicXML(xmlPath, hymn) {
  try {
    const outputPath = xmlPath.replace(/\.xml$/, '.json');
    
    // Update JSON with correct title and number after parsing
    // The parseMusicXML call will create the base JSON
    console.log(`    Parsing ${path.basename(xmlPath)}...`);
    
    // Run musicxml-to-notes.cjs
    execSync(`node ${path.join(process.cwd(), 'scripts/musicxml-to-notes.cjs')} "${xmlPath}"`, {
      stdio: 'inherit'
    });

    // Read the output file
    if (!fs.existsSync(outputPath)) {
      throw new Error('No output file generated');
    }

    let psalmData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    
    // Override title and number from metadata
    psalmData.title = hymn.title;
    psalmData.number = hymn.number;
    
    return psalmData;
  } catch (error) {
    throw new Error(`MusicXML parsing failed: ${error.message}`);
  }
}

/**
 * Create placeholder lyrics if none available
 */
function createPlaceholderLyrics(title) {
  return [{
    number: 1,
    lines: [`Lyrics for "${title}" will be added manually`]
  }];
}

/**
 * Syllabify Dutch text using simple space-based splitting
 */
function syllabify(text) {
  // Split into words, then try to syllabify multi-syllable words
  return text.split(/\s+/).flatMap(word => {
    // Simple Dutch syllabification rules
    const syllables = [];
    let current = '';
    
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      current += char;
      
      // Break after vowels in Dutch
      if ('aeiouyéèêëíìîïóòôöúùûü'.includes(char.toLowerCase()) && i < word.length - 1) {
        // Check if next consonants cluster (Dutch likes 2 consonants)
        const nextChar = word.toLowerCase()[i + 1];
        if ('bcdfghjklmnpqrstvwxyz'.includes(nextChar)) {
          syllables.push(current);
          current = '';
        }
      }
    }
    
    if (current) syllables.push(current);
    return syllables.length > 0 ? syllables : [word];
  });
}

/**
 * Align syllables to match note count
 */
function alignSyllables(syllables, noteCount) {
  if (syllables.length === noteCount) {
    return syllables;
  }

  if (syllables.length > noteCount) {
    // More syllables than notes: combine excess syllables
    const aligned = [];
    const syllablesPerNote = syllables.length / noteCount;

    let idx = 0;
    for (let i = 0; i < noteCount; i++) {
      if (idx >= syllables.length) {
        aligned.push('');
        continue;
      }

      if (i === noteCount - 1) {
        // Last note: combine all remaining
        aligned.push(syllables.slice(idx).join('-'));
      } else {
        const count = Math.ceil(syllablesPerNote * (i + 1)) -
                     Math.ceil(syllablesPerNote * i);
        aligned.push(syllables.slice(idx, idx + count).join('-'));
        idx += count;
      }
    }

    return aligned;
  }

  // Fewer syllables than notes: use melisma (_)
  const aligned = [...syllables];
  for (let i = syllables.length; i < noteCount; i++) {
    aligned.push('_');
  }

  return aligned;
}

/**
 * Process a single hymn
 */
async function processHymn(hymn) {
  console.log(`\nProcessing: ${hymn.title}`);

  const outputDir = path.join(process.cwd(), 'src/lib/data/liederen');
  const xmlPath = path.join(process.cwd(), 'data-raw/melodie', `${hymn.id}.xml`);

  // Skip if XML doesn't exist
  if (!fs.existsSync(xmlPath)) {
    console.log(`  ⚠️  Skipping - XML file not found: ${xmlPath}`);
    return false;
  }

  try {
    // Step 1: Parse MusicXML
    console.log('  Step 1: Parsing MusicXML...');
    const psalmData = parseMusicXML(xmlPath, hymn);

    // Step 2: Add placeholder lyrics (to be filled manually later)
    console.log('  Step 2: Adding placeholder lyrics...');
    const placeholderLyrics = createPlaceholderLyrics(hymn.title);
    const measures = psalmData.melody.measures;

    const verses = [];

    // Create verse 1 with placeholder text matching note count
    const lines = [];
    const syllables = [];

    for (let i = 0; i < Math.min(measures.length, placeholderLyrics[0].lines.length); i++) {
      const lineText = placeholderLyrics[0].lines[i] || '';
      lines.push(lineText);

      const measure = measures[i];
      const noteCount = measure.notes.filter(n => !n.rest).length;

      if (lineText && noteCount > 0) {
        const syllableList = syllabify(lineText);
        const aligned = alignSyllables(syllableList, noteCount);
        syllables.push(aligned);
      } else {
        syllables.push([]);
      }
    }

    psalmData.verses = [{
      number: 1,
      lines: lines,
      syllables: syllables
    }];

    // Step 3: Write output JSON
    console.log('  Step 3: Writing JSON...');
    const outputPath = path.join(outputDir, `${hymn.id}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(psalmData, null, 2));

    console.log(`  ✅ Created: ${outputPath}`);
    return true;

  } catch (error) {
    process.stderr.write(`  ❌ Error processing ${hymn.title}: ${error.message}\n`);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  const metadataPath = process.argv[2];

  if (!metadataPath) {
    process.stderr.write('Usage: node scripts/assemble-lied.cjs <metadata-file>\n');
    process.stderr.write('Example: node scripts/assemble-lied.cjs data-raw/liederen-top50.json\n');
    process.exit(1);
  }

  if (!fs.existsSync(metadataPath)) {
    process.stderr.write(`Metadata file not found: ${metadataPath}\n`);
    process.exit(1);
  }

  try {
    console.log('=====================================');
    console.log('Hymn Assembly Pipeline');
    console.log('=====================================');

    const hymns = loadMetadata(metadataPath);
    console.log(`Found ${hymns.length} hymns in metadata`);

    // Create output directory if needed
    const outputDir = path.join(process.cwd(), 'src/lib/data/liederen');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Process first 10 hymns for testing
    const hymnsToProcess = hymns.slice(0, 10);
    console.log(`\nProcessing first ${hymnsToProcess.length} hymns for testing...\n`);

    let successCount = 0;
    for (const hymn of hymnsToProcess) {
      const success = await processHymn(hymn);
      if (success) successCount++;
    }

    console.log('\n=====================================');
    console.log(`✅ Processed ${successCount}/${hymnsToProcess.length} hymns successfully`);
    console.log('\nNext steps:');
    console.log('1. Run: npm run build');
    console.log('2. Run: npm run dev');
    console.log('3. Test in browser at http://localhost:5173');
    console.log('4. Search for "Lichtstad" to test first hymn');
    console.log('\nNOTE: Lyrics are placeholders. After testing:');
    console.log('- Update src/lib/data/liederen/lied-001.json with actual lyrics');
    console('- Run assembly script again for remaining 40 hymns');

  } catch (error) {
    process.stderr.write('Fatal error: ' + (error?.message || String(error)) + '\n');
    process.stderr.write(error?.stack || '');
    process.exit(1);
  }
}

main();