import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getTransposedKey } from '../src/lib/utils/transposition.js';

describe('getTransposedKey', () => {
  it('uses the simpler enharmonic key signature when transposing down from D', () => {
    assert.equal(getTransposedKey('D', -1), 'Db');
  });

  it('keeps nearby transpositions musically readable', () => {
    assert.equal(getTransposedKey('D', 1), 'Eb');
    assert.equal(getTransposedKey('F#', -1), 'F');
    assert.equal(getTransposedKey('Gb', 1), 'G');
  });
});
