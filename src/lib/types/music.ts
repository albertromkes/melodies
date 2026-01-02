/**
 * Music domain types for psalm melody application
 * Supports JSON file format with measures and rests
 */

/** Accidental configuration for a note */
export interface AccidentalData {
  /** Accidental type: "#" (sharp), "b" (flat), "n" (natural), "##" (double sharp), "bb" (double flat) */
  type: '#' | 'b' | 'n' | '##' | 'bb';
  /** If true, display as cautionary/editorial accidental in parentheses (musica ficta) */
  cautionary?: boolean;
}

/** A single note in VexFlow-compatible format */
export interface NoteData {
  /** Keys in VexFlow format (e.g., ["a/4"], ["c/5"]) */
  keys: string[];
  /** Duration: w=whole, h=half, q=quarter, 8=eighth, 16=sixteenth */
  duration: string;
  /** If true, this is a rest */
  rest?: boolean;
  /** 
   * Optional explicit accidental. Use for musica ficta (cautionary accidentals).
   * If not specified, accidentals are applied automatically based on key signature.
   */
  accidental?: AccidentalData;
  /** 
   * Syllable to display under this note.
   * Use "_" to indicate this note continues the previous syllable (melisma).
   * Omit or leave empty for notes without lyrics.
   */
  syllable?: string;
}

/** A measure/line containing notes and optional lyrics */
export interface Measure {
  notes: NoteData[];
  /** Lyrics text for this line (displayed below the staff) */
  lyrics?: string;
}

/** A verse with lyrics (one line per measure) */
export interface VerseLyrics {
  /** Verse number (1-based) */
  number: number;
  /** Array of lyrics lines (one per measure/line of music) */
  lines: string[];
  /** 
   * Array of syllable arrays (one per measure/line).
   * Each inner array contains syllables aligned to notes.
   * Use "_" for melisma (syllable held over multiple notes).
   */
  syllables?: string[][];
}

/** Melody structure containing just the musical measures */
export interface Melody {
  /** Measures containing the notes */
  measures: Measure[];
}

/** Complete psalm data structure (JSON format) */
export interface PsalmData {
  /** Unique identifier */
  id: string;
  /** Psalm number (e.g., 1, 23, 100) */
  number: number;
  /** Psalm title */
  title: string;
  /** Category (e.g., "psalm") */
  category?: string;
  /** Musical mode or description */
  mode?: string;
  /** Source/origin of the melody */
  source?: string;
  /** Key signature (e.g., "D", "G", "F") */
  keySignature: string;
  /** Time signature as [beats, beatUnit] */
  timeSignature: [number, number];
  /** Clef type */
  clef: string;
  /** The melody (measures with notes) */
  melody: Melody;
  /** All verses (lyrics and syllables, use melody for all) */
  verses: VerseLyrics[];
}

/** Application state for psalm display */
export interface PsalmDisplayState {
  /** Currently selected psalm */
  psalm: PsalmData | null;
  /** Current transposition in semitones from original */
  transposeSemitones: number;
  /** Which verse to display (1+ = verse number) */
  activeVerseNumber: number;
  /** How to display lyrics */
  //lyricDisplayMode: LyricDisplayMode;
}

/** Theme options */
export type Theme = 'light' | 'dark';
