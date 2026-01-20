import { Mode, Note, Chord, Interval } from 'tonal';
import type { ChordData } from '../types/music';

const MODE_MAP: Record<string, string> = {
  'ionian': 'major',
  'major': 'major',
  'dorian': 'dorian',
  'dorisch': 'dorian',
  'phrygian': 'phrygian',
  'lydian': 'lydian',
  'lydisch': 'lydian',
  'mixolydian': 'mixolydian',
  'aeolian': 'minor',
  'aeolisch': 'minor',
  'minor': 'minor',
  'locrian': 'locrian',
};

function normalizeMode(mode: string): string {
  const lower = mode.toLowerCase().split(' ')[0];
  return MODE_MAP[lower] || 'major';
}

function vexKeyToPitchClass(vexKey: string): string {
  const match = vexKey.match(/^([a-g])([#b]*)\/\d$/i);
  if (!match) return '';
  const [, note, accidental] = match;
  return `${note.toUpperCase()}${accidental}`;
}

export function getModeTriads(keySignature: string, mode: string): string[] {
  const normalizedMode = normalizeMode(mode);
  try {
    return Mode.triads(normalizedMode, keySignature);
  } catch {
    return Mode.triads('major', keySignature);
  }
}

export function suggestChordsForNote(
  vexKey: string,
  keySignature: string,
  mode: string
): string[] {
  const notePC = vexKeyToPitchClass(vexKey);
  if (!notePC) return [];
  
  const triads = getModeTriads(keySignature, mode);
  
  return triads.filter(chordName => {
    const chord = Chord.get(chordName);
    return chord.notes.some(cn => Note.pitchClass(cn) === notePC);
  });
}

export function transposeChordSymbol(chordSymbol: string, semitones: number): string {
  if (semitones === 0) return chordSymbol;
  
  const chord = Chord.get(chordSymbol);
  if (!chord.tonic) return chordSymbol;
  
  // Use Interval.fromSemitones to get correct interval notation (e.g., "2m", "-2m")
  const interval = Interval.fromSemitones(semitones);
  if (!interval) return chordSymbol;
  
  const transposedTonic = Note.transpose(chord.tonic, interval);
  if (!transposedTonic) return chordSymbol;
  
  const simplifiedTonic = Note.simplify(transposedTonic) || transposedTonic;
  
  const qualityPart = chordSymbol.slice(chord.tonic.length);
  
  return `${simplifiedTonic}${qualityPart}`;
}

export function transposeChordsInMeasure(
  chords: ChordData[] | undefined,
  semitones: number
): ChordData[] | undefined {
  if (!chords || semitones === 0) return chords;
  
  return chords.map(chord => ({
    ...chord,
    symbol: transposeChordSymbol(chord.symbol, semitones),
  }));
}

export function generateChordsForMelody(
  notes: { keys: string[]; rest?: boolean }[],
  keySignature: string,
  mode: string
): ChordData[] {
  const chords: ChordData[] = [];
  let lastChord: string | null = null;
  
  notes.forEach((note, index) => {
    if (note.rest || !note.keys.length) return;
    
    const suggestions = suggestChordsForNote(note.keys[0], keySignature, mode);
    if (suggestions.length === 0) return;
    
    const bestChord = suggestions[0];
    
    if (bestChord !== lastChord) {
      chords.push({
        symbol: bestChord,
        position: index,
      });
      lastChord = bestChord;
    }
  });
  
  return chords;
}
