import type { Measure, PsalmData, VerseLyrics } from '../types/music';
import { transposeChordsInMeasure } from '../utils/harmonization';

export function getHeaderTitle(psalm: PsalmData): string {
  const trimmedTitle = psalm.title?.trim();
  return trimmedTitle || `Psalm ${psalm.number}`;
}

export function getSortedVerseNumbers(verses: VerseLyrics[]): number[] {
  return verses.map((verse) => verse.number).sort((a, b) => a - b);
}

export function hasHalfLastVerse(verses: VerseLyrics[]): boolean {
  if (verses.length < 2) return false;
  const firstVerseLines = verses[0]?.lines?.length ?? 0;
  const lastVerseLines = verses[verses.length - 1]?.lines?.length ?? 0;
  return lastVerseLines > 0 && lastVerseLines < firstVerseLines * 0.75;
}

export function buildMeasuresForVerse(
  psalm: PsalmData,
  activeVerse: VerseLyrics | undefined,
  transposeSemitones: number
): Measure[] {
  if (!psalm.melody?.measures) return [];

  if (!activeVerse) {
    return psalm.melody.measures.map((measure) => ({
      ...measure,
      chords: transposeChordsInMeasure(measure.chords, transposeSemitones),
    }));
  }

  const lineCount = activeVerse.lines.length;
  const measuresToUse = lineCount > 0
    ? psalm.melody.measures.slice(0, lineCount)
    : psalm.melody.measures;

  return measuresToUse.map((measure, measureIndex) => {
    const newLyrics = activeVerse.lines[measureIndex] ?? '';
    const syllablesForMeasure = activeVerse.syllables?.[measureIndex];
    const transposedChords = transposeChordsInMeasure(measure.chords, transposeSemitones);

    if (syllablesForMeasure) {
      let syllableIndex = 0;
      const notesWithSyllables = measure.notes.map((note) => {
        if (note.rest) {
          return { ...note, syllable: undefined };
        }

        const syllable = syllablesForMeasure[syllableIndex] ?? '';
        syllableIndex += 1;
        return { ...note, syllable };
      });

      return {
        ...measure,
        lyrics: newLyrics,
        notes: notesWithSyllables,
        chords: transposedChords,
      };
    }

    return {
      ...measure,
      lyrics: newLyrics,
      notes: measure.notes.map((note) => ({ ...note, syllable: undefined })),
      chords: transposedChords,
    };
  });
}
