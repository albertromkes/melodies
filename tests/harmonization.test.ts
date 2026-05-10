import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { transposeChordSymbol } from '../src/lib/utils/harmonization.js';

describe('transposeChordSymbol', () => {
  it('transposes a major chord up', () => {
    assert.equal(transposeChordSymbol('C', 2), 'D');
  });

  it('transposes a minor chord up', () => {
    assert.equal(transposeChordSymbol('Cm', 2), 'Dm');
  });

  it('transposes a major chord down', () => {
    assert.equal(transposeChordSymbol('D', -2), 'C');
  });

  it('transposes a minor chord down', () => {
    assert.equal(transposeChordSymbol('Em', -2), 'Dm');
  });

  it('transposes a seventh chord', () => {
    assert.equal(transposeChordSymbol('C7', 2), 'D7');
  });

  it('transposes a major chord with slash bass note', () => {
    const result = transposeChordSymbol('D/F#', 1);
    assert.equal(result, 'Eb/G');
  });

  it('transposes a minor chord with slash bass note', () => {
    const result = transposeChordSymbol('Am/C', -2);
    assert.equal(result, 'Gm/Bb');
  });

  it('transposes a seventh chord with slash bass note', () => {
    const result = transposeChordSymbol('C7/E', 2);
    assert.equal(result, 'D7/F#');
  });

  it('transposes a major chord with flat slash bass', () => {
    const result = transposeChordSymbol('Dm/F', 2);
    assert.equal(result, 'Em/G');
  });

  it('transposes a major chord with sharp slash bass', () => {
    const result = transposeChordSymbol('F#/A#', 1);
    assert.equal(result, 'G/B');
  });

it('handles slash chord where transposition changes enharmonic spelling', () => {
    // D/F# up -1: D->C#, F#->F
    const result = transposeChordSymbol('D/F#', -1);
    assert.equal(result, 'C#/F');
  });

  it('handles slash chord where both root and bass transpose', () => {
    // D/F# up 3 semitones: D -> F, F# -> A
    const result = transposeChordSymbol('D/F#', 3);
    assert.equal(result, 'F/A');
  });

  it('returns original chord for zero semitones', () => {
    assert.equal(transposeChordSymbol('C', 0), 'C');
  });

  it('returns original chord for slash chord with zero semitones', () => {
    assert.equal(transposeChordSymbol('D/F#', 0), 'D/F#');
  });

  it('returns original chord for unparseable chord', () => {
    assert.equal(transposeChordSymbol('xyz', 2), 'xyz');
  });

  it('preserves quality part for regular chords', () => {
    assert.equal(transposeChordSymbol('Cmaj7', 2), 'Dmaj7');
    assert.equal(transposeChordSymbol('Cm7b5', 2), 'Dm7b5');
    assert.equal(transposeChordSymbol('Cadd9', 2), 'Dadd9');
  });

  it('transposes up by octaves correctly', () => {
    assert.equal(transposeChordSymbol('C', 12), 'C');
    assert.equal(transposeChordSymbol('Cm', 12), 'Cm');
  });

  it('transposes across enharmonic boundary', () => {
    assert.equal(transposeChordSymbol('B', 1), 'C');
    // Fb up 1 = F (Fb is enharmonic to E, but Fb+1 semitone = F)
    assert.equal(transposeChordSymbol('Fb', 1), 'F');
  });

  it('slash chord: D/F# transposed to Eb key', () => {
    // D up 1 semitone = Eb, F# up 1 semitone = G
    const result = transposeChordSymbol('D/F#', 1);
    assert.equal(result, 'Eb/G');
  });

  it('slash chord: Bm/F# transposed down 2 semitones', () => {
    // B -> A, F# -> E
    const result = transposeChordSymbol('Bm/F#', -2);
    assert.equal(result, 'Am/E');
  });
});
