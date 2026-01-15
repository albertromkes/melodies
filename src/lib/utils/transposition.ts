/**
 * Transposition utilities using tonal library
 * Handles all pitch manipulation to ensure musical correctness
 */

import { Note, Interval, Key } from 'tonal';
import type { NoteData, AccidentalData } from '../types/music';

/**
 * Convert VexFlow key format to scientific notation
 * "a/4" -> "A4", "f#/4" -> "F#4", "bb/4" -> "Bb4"
 */
function vexKeyToScientific(vexKey: string): string {
  const match = vexKey.match(/^([a-g])([#b]*)\/(\d)$/i);
  if (!match) return vexKey;
  
  const [, note, accidental, octave] = match;
  return `${note.toUpperCase()}${accidental}${octave}`;
}

/**
 * Convert scientific notation to VexFlow key format
 * "A4" -> "a/4", "F#4" -> "f#/4", "Bb4" -> "bb/4"
 */
function scientificToVexKey(pitch: string): string {
  const match = pitch.match(/^([A-G])([#b]*)(\d)$/i);
  if (!match) return pitch;
  
  const [, note, accidental, octave] = match;
  return `${note.toLowerCase()}${accidental}/${octave}`;
}

/**
 * Get the accidental from a VexFlow key
 * "f#/4" -> "#", "bb/4" -> "b", "a/4" -> ""
 */
function getAccidentalFromVexKey(vexKey: string): string {
  const match = vexKey.match(/^[a-g]([#b]*)\/\d$/i);
  return match ? match[1] : '';
}

/**
 * Get the notes that are sharped/flatted in a given key signature
 * Returns a map of note letter -> accidental
 */
function getKeySignatureAccidentals(keySignature: string): Map<string, string> {
  const accidentals = new Map<string, string>();
  
  try {
    // Get the key info from tonal - handle both major and minor keys
    const keyInfo = Key.majorKey(keySignature);
    if (keyInfo && keyInfo.scale) {
      // Go through the scale and extract accidentals
      for (const note of keyInfo.scale) {
        const letter = note[0].toUpperCase();
        const acc = note.slice(1); // Everything after the letter (could be #, b, ##, bb, or empty)
        if (acc) {
          accidentals.set(letter, acc);
        }
      }
    }
  } catch {
    // If key parsing fails, return empty map (no accidentals)
  }
  
  return accidentals;
}

/**
 * Check if a note's accidental differs from what the key signature would provide
 * This determines if an explicit accidental is needed
 */
function needsExplicitAccidental(
  noteLetter: string,
  noteAccidental: string,
  keySignature: string
): boolean {
  const keyAccidentals = getKeySignatureAccidentals(keySignature);
  const keyAccidental = keyAccidentals.get(noteLetter.toUpperCase()) || '';
  
  // If the note's accidental differs from the key signature, it needs explicit accidental
  return noteAccidental !== keyAccidental;
}

/**
 * Determine the accidental type for VexFlow based on the accidental string
 */
function accidentalStringToType(acc: string): AccidentalData['type'] | null {
  switch (acc) {
    case '#': return '#';
    case 'b': return 'b';
    case '##': return '##';
    case 'bb': return 'bb';
    case 'n': return 'n';
    default: return null;
  }
}

/**
 * Transpose a single pitch by a number of semitones
 * @param pitch - The pitch in scientific notation (e.g., "C4", "F#5")
 * @param semitones - Number of semitones to transpose (positive = up, negative = down)
 * @returns The transposed pitch in scientific notation
 */
export function transposePitch(pitch: string, semitones: number): string {
  if (semitones === 0) return pitch;
  
  const transposed = Note.transpose(pitch, Interval.fromSemitones(semitones));
  
  // Simplify enharmonic spelling for readability
  const simplified = Note.simplify(transposed);
  return simplified || transposed;
}

/**
 * Transpose a VexFlow key by semitones
 * @param vexKey - Key in VexFlow format (e.g., "a/4", "f#/4")
 * @param semitones - Number of semitones to transpose
 * @returns Transposed key in VexFlow format
 */
export function transposeVexKey(vexKey: string, semitones: number): string {
  if (semitones === 0) return vexKey;
  
  const scientific = vexKeyToScientific(vexKey);
  const transposed = transposePitch(scientific, semitones);
  return scientificToVexKey(transposed);
}

/**
 * Transpose a NoteData object
 * @param note - The note data to transpose
 * @param semitones - Number of semitones to transpose
 * @returns A new NoteData with transposed keys
 */
export function transposeNoteData(note: NoteData, semitones: number): NoteData {
  if (semitones === 0 || note.rest) return note;
  
  return {
    ...note,
    keys: note.keys.map(key => transposeVexKey(key, semitones)),
    // Remove accidental when transposing - it will be recalculated
    // based on the new key signature by transposeNoteDataWithKey
    accidental: undefined,
  };
}

/**
 * Respell a pitch to match the key signature's preference (sharps vs flats)
 * @param pitch - The pitch in scientific notation
 * @param keySignature - The target key signature
 */
function respellPitch(pitch: string, keySignature: string): string {
  try {
    const keyData = Key.majorKey(keySignature);
    
    // If we have a flat key (negative alteration), prefer flats
    // This covers F (-1) through Cb (-7)
    if (keyData.alteration < 0) {
      if (pitch.includes('#')) {
        return Note.enharmonic(pitch);
      }
    } 
    // If we have a sharp key (positive alteration), prefer sharps
    // This covers G (1) through C# (7)
    else if (keyData.alteration > 0) {
      if (pitch.includes('b')) {
        return Note.enharmonic(pitch);
      }
    }
    // C Major (0) - usually keep as is
    
  } catch (e) {
    // If key parsing fails, keep pitch as is
  }
  
  return pitch;
}

/**
 * Transpose a NoteData object with key signature awareness for accidentals
 * This properly handles cautionary accidentals (musica ficta)
 * @param note - The note data to transpose
 * @param semitones - Number of semitones to transpose
 * @param originalKey - Original key signature
 * @param newKey - New key signature after transposition
 * @returns A new NoteData with transposed keys and correct accidentals
 */
export function transposeNoteDataWithKey(
  note: NoteData, 
  semitones: number,
  originalKey: string,
  newKey: string
): NoteData {
  if (semitones === 0 || note.rest) return note;
  
  const transposedKeys = note.keys.map(key => {
    const scientific = vexKeyToScientific(key);
    const transposed = transposePitch(scientific, semitones);
    const respelled = respellPitch(transposed, newKey);
    return scientificToVexKey(respelled);
  });
  
  // If the original note had an accidental, we need to handle it specially
  if (note.accidental) {
    // Get the original pitch with the accidental applied
    const originalKey0 = note.keys[0];
    const accType = note.accidental.type;
    
    // Parse the original key: "a/4" -> letter="a", octave="4"
    const match = originalKey0.match(/^([a-g])([#b]*)\/(\d)$/i);
    if (match) {
      const [, letter, existingAcc, octave] = match;
      
      // The full pitch including the explicit accidental
      // e.g., "a/4" with accidental "#" means A#4
      let fullAccidental = existingAcc;
      if (accType === '#' && !existingAcc.includes('#')) {
        fullAccidental = existingAcc + '#';
      } else if (accType === 'b' && !existingAcc.includes('b')) {
        fullAccidental = existingAcc + 'b';
      } else if (accType === 'n') {
        fullAccidental = ''; // Natural removes any accidental
      }
      
      // Create the full pitch and transpose it
      const fullPitch = `${letter.toUpperCase()}${fullAccidental}${octave}`;
      const transposedPitch = transposePitch(fullPitch, semitones);
      const respelledPitch = respellPitch(transposedPitch, newKey);
      const transposedVexKey = scientificToVexKey(respelledPitch);
      
      // Get the accidental of the transposed pitch
      const transposedAcc = getAccidentalFromVexKey(transposedVexKey);
      
      // Check if this accidental differs from what the new key signature provides
      const transposedMatch = transposedVexKey.match(/^([a-g])([#b]*)\/(\d)$/i);
      if (transposedMatch) {
        const transposedLetter = transposedMatch[1];
        
        if (needsExplicitAccidental(transposedLetter, transposedAcc, newKey)) {
          // We need an explicit accidental
          const accidentalType = transposedAcc ? accidentalStringToType(transposedAcc) : 'n';
          
          if (accidentalType) {
            return {
              ...note,
              keys: [transposedVexKey],
              accidental: {
                type: accidentalType,
                cautionary: note.accidental.cautionary,
              },
            };
          }
        }
      }
      
      // No explicit accidental needed - the key signature handles it
      // But we still use the transposed pitch (which might have the accidental built-in)
      return {
        ...note,
        keys: [transposedVexKey],
        accidental: undefined,
      };
    }
  }
  
  // No original accidental, simple transposition
  return {
    ...note,
    keys: transposedKeys,
    accidental: undefined,
  };
}

/**
 * Transpose an array of notes
 * @param notes - Array of NoteData to transpose
 * @param semitones - Number of semitones to transpose
 * @returns New array with transposed notes
 */
export function transposeNotes(notes: NoteData[], semitones: number): NoteData[] {
  if (semitones === 0) return notes;
  return notes.map(note => transposeNoteData(note, semitones));
}

/**
 * Transpose an array of notes with key signature awareness
 * This properly handles cautionary accidentals (musica ficta)
 * @param notes - Array of NoteData to transpose
 * @param semitones - Number of semitones to transpose
 * @param originalKey - Original key signature
 * @param newKey - New key signature after transposition
 * @returns New array with transposed notes and correct accidentals
 */
export function transposeNotesWithKey(
  notes: NoteData[], 
  semitones: number,
  originalKey: string,
  newKey: string
): NoteData[] {
  if (semitones === 0) return notes;
  return notes.map(note => transposeNoteDataWithKey(note, semitones, originalKey, newKey));
}

/**
 * Get the display name for a transposition amount
 * @param semitones - Number of semitones
 * @returns Human-readable string (e.g., "+2", "-3", "Original")
 */
export function getTranspositionLabel(semitones: number): string {
  if (semitones === 0) return 'Original';
  return semitones > 0 ? `+${semitones}` : `${semitones}`;
}

/**
 * Calculate the resulting key after transposition
 * @param originalKey - The original key (e.g., "C", "G")
 * @param semitones - Number of semitones to transpose
 * @returns The new key name
 */
export function getTransposedKey(originalKey: string, semitones: number): string {
  if (semitones === 0) return originalKey;
  
  // Add octave to make it a valid pitch, transpose, then remove octave
  const transposed = transposePitch(originalKey + '4', semitones);
  let key = transposed.slice(0, -1);
  
  // Map non-standard VexFlow keys to enharmonic equivalents
  // VexFlow supports standard keys up to 7 accidentals
  const enharmonics: Record<string, string> = {
    'G#': 'Ab', // 8 sharps -> 4 flats
    'A#': 'Bb', // 10 sharps -> 2 flats
    'D#': 'Eb', // 9 sharps -> 3 flats
    'E#': 'F',  // 11 sharps -> 1 flat
    'B#': 'C',  // 12 sharps -> 0 accidentals
    'Fb': 'E',  // 8 flats -> 4 sharps
  };
  
  if (enharmonics[key]) {
    key = enharmonics[key];
  }
  
  return key;
}
