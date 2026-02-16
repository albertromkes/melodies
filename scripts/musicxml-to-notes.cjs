#!/usr/bin/env node

/**
 * Convert MusicXML to NoteData format for Psalm Melodies
 * Usage: node scripts/musicxml-to-notes.ts input.xml
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Duration mapping from MusicXML to VexFlow format
const DURATION_MAP = {
  'whole': 'w',
  'half': 'h',
  'quarter': 'q',
  'eighth': '8',
  '16th': '16',
  '32nd': '32',
  '64th': '64',
  'breve': 'b',
  'long': 'l',
};

const DURATION_FROM_BEATS = {
  1: 'w',
  2: 'h',
  4: 'q',
  8: '8',
  16: '16',
  32: '32',
};

// Key signature mapping (fifths to note name)
const KEY_SIGNATURES = [
  'Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'
];

// Clef types
const CLEF_TYPES = {
  'G': 'treble',
  'F': 'bass',
  'C': 'alto',
};

// Note name mapping
const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * Parse MusicXML file
 */
async function parseMusicXML(filePath) {
  const xmlContent = fs.readFileSync(filePath, 'utf-8');
  const parser = new xml2js.Parser();
  return parser.parseStringPromise(xmlContent);
}

/**
 * Convert MusicXML accidental to our format
 */
function convertAccidental(accidental) {
  if (!accidental) return undefined;

  const map = {
    'sharp': '#',
    'flat': 'b',
    'natural': 'n',
    'double-sharp': '##',
    'double-flat': 'bb',
  };

  return map[accidental.toLowerCase()];
}

/**
 * Get key signature from MusicXML
 */
function getKeySignature(part) {
  const attributes = part?.measure?.[0]?.attributes?.[0];

  if (attributes?.key?.[0]?.['fifths'] !== undefined) {
    const fifths = parseInt(attributes.key[0].fifths[0], 10);
    return KEY_SIGNATURES[fifths + 7] || 'C';
  }

  return 'C';
}

/**
 * Get time signature from MusicXML
 */
function getTimeSignature(part) {
  const attributes = part?.measure?.[0]?.attributes?.[0];

  if (attributes?.time?.[0]) {
    const time = attributes.time[0];
    const beats = parseInt(time['beats'][0], 10);
    const beatType = parseInt(time['beat-type'][0], 10);
    return [beats, beatType];
  }

  return [4, 4];
}

/**
 * Get clef from MusicXML
 */
function getClef(part) {
  const attributes = part?.measure?.[0]?.attributes?.[0];

  if (attributes?.clef?.[0]) {
    const clef = attributes.clef[0];
    if (clef['sign']) {
      return CLEF_TYPES[clef.sign[0]] || 'treble';
    }
  }

  return 'treble';
}

/**
 * Convert pitch to VexFlow key format (e.g., "c/4", "d#/5")
 */
function pitchToKey(pitch, keySignature) {
  if (!pitch) return 'c/4';

  const step = pitch.step?.[0]?.toLowerCase() || 'c';
  const octave = parseInt(pitch.octave?.[0] || '4', 10);
  const alter = pitch.alter ? parseInt(pitch.alter[0], 10) : 0;

  // Convert to sharp/flat if needed based on accidentals
  let noteName = step.toUpperCase();

  if (alter !== 0) {
    if (alter === 1) noteName += '#';
    else if (alter === -1) noteName += 'b';
    else if (alter === 2) noteName += '##';
    else if (alter === -2) noteName += 'bb';
  }

  return `${noteName}/${octave}`;
}

/**
 * Convert MusicXML measure to our Measure format
 */
function convertMeasure(measureXml, keySignature) {
  const notes = [];

  // Get all notes in this measure
  const musicData = measureXml?.note || [];

  for (const note of musicData) {
    const isRest = note.rest !== undefined;

    if (isRest) {
      // Get duration
      const duration = note.duration?.[0] ? getDurationFromMusicXML(note) : 'q';
      notes.push({
        keys: ['b/4'], // Any note for rest
        duration,
        rest: true,
      });
    } else {
      const pitch = note.pitch?.[0];
      const key = pitchToKey(pitch, keySignature);

      // Get duration
      const duration = note.duration?.[0] ? getDurationFromMusicXML(note) : 'q';

      // Get accidental
      const accidentalType = convertAccidental(note.accidental?.[0]);

      const noteData = {
        keys: [key],
        duration,
      };

      if (accidentalType) {
        noteData.accidental = { type: accidentalType };
      }

      notes.push(noteData);
    }
  }

  return { notes };
}

/**
 * Get duration from MusicXML note
 */
function getDurationFromMusicXML(note) {
  // Try duration type
  if (note.type?.[0]) {
    const type = note.type[0].toLowerCase();
    const mapped = DURATION_MAP[type];
    if (mapped) return mapped;
  }

  // Fallback to duration value
  if (note.duration?.[0]) {
    const duration = parseInt(note.duration[0], 10);
    // Map common duration values
    const mapped = DURATION_FROM_BEATS[duration];
    if (mapped) return mapped;

    // Calculate from quarter note basis
    const quarterDuration = 4; // Assuming quarter note = 4
    const ratio = quarterDuration / duration;
    if (ratio === 1) return 'q';
    if (ratio === 2) return 'h';
    if (ratio === 0.5) return '8';
    if (ratio === 4) return 'w';
    if (ratio === 0.25) return '16';
  }

  return 'q'; // Default to quarter note
}

/**
 * Main conversion function
 */
async function convertMusicXML(filePath, options = {}) {
  console.log(`Parsing MusicXML: ${filePath}`);

  const xml = await parseMusicXML(filePath);

  // Get the first part (assuming single-part melody)
  const part = xml['score-partwise']?.part?.[0];

  if (!part) {
    throw new Error('No part found in MusicXML');
  }

  // Get musical attributes
  const keySignature = getKeySignature(part);
  const timeSignature = getTimeSignature(part);
  const clef = getClef(part);

  // Convert all measures
  const measures = [];
  const measureList = Array.isArray(part.measure) ? part.measure : [part.measure];

  for (const measureXml of measureList) {
    const measure = convertMeasure(measureXml, keySignature);
    measures.push(measure);
  }

  // Build PsalmData structure
  const psalmData = {
    id: options.id || 'unknown',
    number: options.number || 0,
    title: options.title || 'Unknown',
    category: options.category || 'lied',
    keySignature,
    timeSignature,
    clef,
    melody: { measures },
    verses: [],
  };

  console.log(`Converted ${measures.length} measures`);
  console.log(`Key: ${keySignature}, Time: ${timeSignature.join('/')}, Clef: ${clef}`);

  return psalmData;
}

/**
 * Main execution
 */
async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: node scripts/musicxml-to-notes.ts <input.xml>');
    console.error('Example: node scripts/musicxml-to-notes.ts data-raw/melodie/lied-001.xml');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    // Extract metadata from filename: lied-XXX-Title or lied-XXX
    const filename = path.basename(filePath, '.xml');
    const numberMatch = filename.match(/\d+/);
    const number = numberMatch ? parseInt(numberMatch[0], 10) : 0;

    const options = {
      id: filename,
      number: number,
      title: path.basename(filePath, '.xml').replace(/^\d+-/, '').replace(/-+/g, ' '),
      category: 'lied',
    };

    const psalmData = await convertMusicXML(filePath, options);

    // Output JSON
    const outputPath = filePath.replace(/\.xml$/, '.json');
    fs.writeFileSync(outputPath, JSON.stringify(psalmData, null, 2));

    console.log(`\nOutput written to: ${outputPath}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();