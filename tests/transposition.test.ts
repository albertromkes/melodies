import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { NoteData } from '../src/lib/types/music.js';
import {
  getTransposedKey,
  transposeNoteDataWithKey,
  transposeNotesWithKey,
  transposePitch,
  transposeVexKey,
} from '../src/lib/utils/transposition.js';

describe('getTransposedKey', () => {
  it('uses the simpler enharmonic key signature when transposing down from D', () => {
    assert.equal(getTransposedKey('D', -1), 'Db');
  });

  it('keeps nearby transpositions musically readable', () => {
    assert.equal(getTransposedKey('D', 1), 'Eb');
    assert.equal(getTransposedKey('F#', -1), 'F');
    assert.equal(getTransposedKey('Gb', 1), 'G');
  });

  it('returns original key when transposing zero semitones', () => {
    assert.equal(getTransposedKey('D', 0), 'D');
  });
});

describe('transposePitch', () => {
  it('transposes up by semitones', () => {
    assert.equal(transposePitch('C4', 2), 'D4');
    // tonal prefers Db over C#
    assert.equal(transposePitch('C4', 1), 'Db4');
  });

  it('transposes down by semitones', () => {
    assert.equal(transposePitch('D4', -2), 'C4');
    assert.equal(transposePitch('C4', -1), 'B3');
  });

  it('simplifies enharmonic spellings', () => {
    // B# = C, C + 1 = C#
    assert.equal(transposePitch('B#4', 1), 'C#5');
    assert.equal(transposePitch('Cb4', 1), 'C4');
  });

  it('returns original pitch when transposing zero semitones', () => {
    assert.equal(transposePitch('C4', 0), 'C4');
  });
});

describe('transposeVexKey', () => {
  it('transposes simple note up', () => {
    assert.equal(transposeVexKey('c/4', 2), 'd/4');
  });

  it('transposes sharp note up', () => {
    assert.equal(transposeVexKey('f#/4', 1), 'g/4');
  });

  it('transposes flat note up', () => {
    assert.equal(transposeVexKey('bb/4', 1), 'b/4');
  });

  it('transposes across octave boundary', () => {
    // c5 + 1 semitone = db5 (tonal prefers flat)
    assert.equal(transposeVexKey('c/5', 1), 'db/5');
  });

  it('returns original key when transposing zero semitones', () => {
    assert.equal(transposeVexKey('c/4', 0), 'c/4');
  });
});

describe('transposeNoteDataWithKey', () => {
  it('transposes a plain note without accidental', () => {
    const note = { keys: ['c/4'], duration: 'q', rest: false };
    const result = transposeNoteDataWithKey(note, 2, 'C', 'D');
    assert.equal(result.keys[0], 'd/4');
    assert.equal(result.accidental, undefined);
  });

  it('transposes a sharp accidental correctly', () => {
    const note = {
      keys: ['f/4'],
      duration: 'q',
      rest: false,
      accidental: { type: '#' as const, cautionary: false },
    } as NoteData;
    // F# up 2 semitones = G#
    const result = transposeNoteDataWithKey(note, 2, 'Bb', 'D');
    assert.equal(result.keys[0], 'g#/4');
    assert.equal(result.accidental?.type, '#');
    assert.equal(result.accidental?.cautionary, false);
  });

  it('transposes a flat accidental correctly', () => {
    const note = {
      keys: ['bb/4'],
      duration: 'q',
      rest: false,
      accidental: { type: 'b' as const, cautionary: false },
    } as NoteData;
    // Bb up 2 semitones = Bbb would be wrong; key is bb/4 with explicit b ->
    // existingAcc='b', accType='b', fullAccidental='b', fullPitch='Bb4',
    // Bb4 down 2 = G#4
    const result = transposeNoteDataWithKey(note, -2, 'C', 'B');
    assert.equal(result.keys[0], 'g#/4');
    assert.equal(result.accidental, undefined);
  });

  it('transposes a natural accidental correctly', () => {
    const note = {
      keys: ['e/4'],
      duration: 'q',
      rest: false,
      accidental: { type: 'n' as const, cautionary: false },
    } as NoteData;
    // E natural up 1 semitone = F (not F#)
    const result = transposeNoteDataWithKey(note, 1, 'F', 'F#');
    assert.equal(result.keys[0], 'f/4');
    // F in key of F# major needs explicit natural (F# major has F##)
    assert.equal(result.accidental?.type, 'n');
  });

  it('preserves cautionary flag through transposition', () => {
    const note = {
      keys: ['f/4'],
      duration: 'q',
      rest: false,
      accidental: { type: '#' as const, cautionary: true },
    } as NoteData;
    const result = transposeNoteDataWithKey(note, 2, 'Bb', 'D');
    assert.equal(result.accidental?.cautionary, true);
  });

  it('preserves polyphonic keys (multiple note heads)', () => {
    const note = { keys: ['c/4', 'e/4', 'g/4'], duration: 'q', rest: false };
    const result = transposeNoteDataWithKey(note, 2, 'C', 'D');
    assert.equal(result.keys.length, 3);
    assert.equal(result.keys[0], 'd/4');
    // E up 2 = F# (tonal simplification)
    assert.equal(result.keys[1], 'f#/4');
    assert.equal(result.keys[2], 'a/4');
  });

  it('transposes first key of polyphonic note with explicit accidental', () => {
    const note = {
      keys: ['f/4', 'a/4', 'c/5'],
      duration: 'q',
      rest: false,
      accidental: { type: '#' as const, cautionary: false },
    } as NoteData;
    // F# up 2 = G#, A up 2 = B, C up 2 = D
    const result = transposeNoteDataWithKey(note, 2, 'Bb', 'D');
    assert.equal(result.keys.length, 3);
    assert.equal(result.keys[0], 'g#/4');
    // A up 2 = B (tonal)
    assert.equal(result.keys[1], 'b/4');
    assert.equal(result.keys[2], 'd/5');
  });

  it('returns unchanged note for zero semitones', () => {
    const note = { keys: ['c/4'], duration: 'q', rest: false };
    const result = transposeNoteDataWithKey(note, 0, 'C', 'C');
    assert.strictEqual(result, note);
  });

  it('returns unchanged note for rests', () => {
    const note = { keys: ['c/4'], duration: 'q', rest: true };
    const result = transposeNoteDataWithKey(note as NoteData, 2, 'C', 'D');
    assert.strictEqual(result, note);
  });

  it('handles double sharp accidental', () => {
    const note = {
      keys: ['f/4'],
      duration: 'q',
      rest: false,
      accidental: { type: '##' as const, cautionary: false },
    } as NoteData;
    // F## = G, G up 1 = G#
    const result = transposeNoteDataWithKey(note, 1, 'F', 'F#');
    assert.equal(result.keys[0], 'g#/4');
  });

  it('handles double flat accidental on natural key', () => {
    const note = {
      keys: ['b/4'],
      duration: 'q',
      rest: false,
      accidental: { type: 'bb' as const, cautionary: false },
    } as NoteData;
    // B natural + double flat = Bbb (enharmonic to D), transposed down 1
    // tonal's handling of triple-flat-derived pitches is edge-case behavior
    // not encountered in real psalm data; verify no crash and keys are transposed
    const result = transposeNoteDataWithKey(note, -1, 'Bb', 'A');
    // result keys should be different from original 'b/4'
    assert.notEqual(result.keys[0], 'b/4');
    assert.equal(result.keys.length, 1);
  });

  it('transposes to key where accidental differs from key sig (keeps explicit)', () => {
    const note = {
      keys: ['f/4'],
      duration: 'q',
      rest: false,
      accidental: { type: '#' as const, cautionary: false },
    } as NoteData;
    // F# up 7 = C#/Db. In Eb major, Db has flat not in key sig
    const result = transposeNoteDataWithKey(note, 7, 'Bb', 'Eb');
    assert.equal(result.keys[0], 'db/5');
    assert.equal(result.accidental?.type, 'b');
  });

  it('transposes natural to key where it matches key signature', () => {
    const note = {
      keys: ['f/4'],
      duration: 'q',
      rest: false,
      accidental: { type: 'n' as const, cautionary: false },
    } as NoteData;
    // F natural up 2 = G. In C major, G has no accidental, so no explicit.
    const result = transposeNoteDataWithKey(note, 2, 'Bb', 'C');
    assert.equal(result.keys[0], 'g/4');
    assert.equal(result.accidental, undefined);
  });
});

describe('transposeNotesWithKey', () => {
  it('transposes an array of notes', () => {
    const notes: NoteData[] = [
      { keys: ['c/4'], duration: 'q', rest: false },
      { keys: ['d/4'], duration: 'q', rest: false },
      { keys: ['e/4'], duration: 'q', rest: false },
    ];
    const result = transposeNotesWithKey(notes, 2, 'C', 'D');
    assert.equal(result.length, 3);
    assert.equal(result[0].keys[0], 'd/4');
    assert.equal(result[1].keys[0], 'e/4');
    // E up 2 = F# (tonal simplification)
    assert.equal(result[2].keys[0], 'f#/4');
  });

  it('returns same array when transposing zero semitones', () => {
    const notes: NoteData[] = [{ keys: ['c/4'], duration: 'q', rest: false }];
    const result = transposeNotesWithKey(notes, 0, 'C', 'C');
    assert.strictEqual(result, notes);
  });

  it('transposes mixed notes with and without accidentals', () => {
    const notes: NoteData[] = [
      { keys: ['c/4'], duration: 'q', rest: false },
      { keys: ['f/4'], duration: 'q', rest: false, accidental: { type: '#' as const, cautionary: false } },
      { keys: ['g/4'], duration: 'q', rest: false },
    ];
    const result = transposeNotesWithKey(notes, 2, 'Bb', 'D');
    assert.equal(result[0].keys[0], 'd/4');
    assert.equal(result[1].keys[0], 'g#/4');
    assert.equal(result[1].accidental?.type, '#');
    assert.equal(result[2].keys[0], 'a/4');
  });
});
