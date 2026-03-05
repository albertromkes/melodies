import { Chord, Interval, Note } from 'tonal';
import type { ChordData, PsalmData } from '../types/music';

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

/**
 * Checks if a psalm has any chord notations in its melody
 * @param psalm The psalm data to check
 * @returns true if any measure contains chord data
 */
export function hasChordNotations(psalm: PsalmData): boolean {
  return psalm.melody.measures.some(measure => 
    measure.chords && measure.chords.length > 0
  );
}
