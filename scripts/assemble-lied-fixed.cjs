#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const log = (msg) => process.stdout.write(msg + '\n');

function loadMetadata(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function parseMusicXML(xmlPath, hymn) {
  const outputPath = xmlPath.replace(/\.xml$/, '.json');
  log(`    Parsing ${path.basename(xmlPath)}...`);
  execSync(`node ${path.join(process.cwd(), 'scripts/musicxml-to-notes.cjs')} "${xmlPath}"`, { stdio: 'inherit' });
  if (!fs.existsSync(outputPath)) throw new Error('No output file generated');
  let psalmData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  psalmData.title = hymn.title;
  psalmData.number = hymn.number;
  return psalmData;
}

function createPlaceholderLyrics(title) {
  return [{ number: 1, lines: [`Lyrics for "${title}" will be added manually`] }];
}

function syllabify(text) {
  return text.split(/\s+/).flatMap(word => {
    const syllables = [];
    let current = '';
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      current += char;
      if ('aeiouy'.includes(char.toLowerCase()) && i < word.length - 1) {
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

function alignSyllables(syllables, noteCount) {
  if (syllables.length === noteCount) return syllables;
  if (syllables.length > noteCount) {
    const aligned = [];
    const syllablesPerNote = syllables.length / noteCount;
    let idx = 0;
    for (let i = 0; i < noteCount; i++) {
      if (idx >= syllables.length) {
        aligned.push('');
        continue;
      }
      if (i === noteCount - 1) {
        aligned.push(syllables.slice(idx).join('-'));
        break;
      }
      const count = Math.ceil(syllablesPerNote * (i + 1)) - Math.ceil(syllablesPerNote * i);
      aligned.push(syllables.slice(idx, idx + count).join('-'));
      idx += count;
    }
    return aligned;
  }
  const aligned = [...syllables];
  for (let i = syllables.length; i < noteCount; i++) aligned.push('_');
  return aligned;
}

async function processHymn(hymn) {
  log(`\nProcessing: ${hymn.title}`);
  const xmlPath = path.join(process.cwd(), 'data-raw/melodie', `${hymn.id}.xml`);

  if (!fs.existsSync(xmlPath)) {
    log(`  ⚠️  Skipping - XML file not found: ${xmlPath}`);
    return false;
  }

  try {
    log('  Step 1: Parsing MusicXML...');
    const psalmData = parseMusicXML(xmlPath, hymn);

    log('  Step 2: Adding placeholder lyrics...');
    const placeholderLyrics = createPlaceholderLyrics(hymn.title);
    const measures = psalmData.melody.measures;

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

    psalmData.verses = [{ number: 1, lines, syllables }];

    log('  Step 3: Writing JSON...');
    const outputPath = path.join(process.cwd(), 'src/lib/data/liederen', `${hymn.id}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(psalmData, null, 2));
    log(`  ✅ Created: ${outputPath}`);
    return true;
  } catch (error) {
    process.stderr.write(`  ❌ Error processing ${hymn.title}: ${error.message}\n`);
    return false;
  }
}

async function main() {
  const metadataPath = process.argv[2];
  if (!metadataPath) {
    process.stderr.write('Usage: node scripts/assemble-lied-fixed.cjs <metadata-file>\n');
    process.exit(1);
  }

  if (!fs.existsSync(metadataPath)) {
    process.stderr.write(`Metadata file not found: ${metadataPath}\n`);
    process.exit(1);
  }

  try {
    log('=====================================');
    log('Hymn Assembly Pipeline');
    log('=====================================');

    const hymns = loadMetadata(metadataPath);
    log(`Found ${hymns.length} hymns in metadata`);

    const outputDir = path.join(process.cwd(), 'src/lib/data/liederen');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const hymnsToProcess = hymns.slice(0, 10);
    log(`\nProcessing first ${hymnsToProcess.length} hymns for testing...\n`);

    let successCount = 0;
    for (const hymn of hymnsToProcess) {
      const success = await processHymn(hymn);
      if (success) successCount++;
    }

    log('\n=====================================');
    log(`✅ Processed ${successCount}/${hymnsToProcess.length} hymns successfully`);
    log('\nNext steps:');
    log('1. Run: npm run build');
    log('2. Run: npm run dev');
    log('3. Test in browser at http://localhost:5173');
    log('4. Search for "Lichtstad" to test first hymn');
    log('\nNOTE: Lyrics are placeholders. After testing:');
    log('- Update src/lib/data/liederen/lied-001.json with actual lyrics');
    log('- Run assembly script again for remaining 40 hymns');
  } catch (error) {
    process.stderr.write('Fatal error: ' + (error?.message || String(error)) + '\n');
    process.stderr.write(error?.stack || '');
    process.exit(1);
  }
}

main();
