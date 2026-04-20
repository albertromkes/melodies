import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActiveSetlist } from '../types/setlist';
import type { PsalmData } from '../types/music';
import {
  ACTIVE_SETLIST_STORAGE_KEY,
  addSongToSetlist,
  clearSetlist,
  createDefaultActiveSetlist,
  getNextSetlistItem,
  getPreviousSetlistItem,
  loadActiveSetlist,
  moveSetlistItemDown,
  moveSetlistItemUp,
  normalizeActiveSetlist,
  removeSetlistItem,
  resolveRenderableSetlistItems,
  saveActiveSetlist,
  updateSetlistItemTranspose,
} from './setlist';

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function createSong(id: string, number: number, title: string): PsalmData {
  return {
    id,
    number,
    title,
    category: 'psalmen',
    keySignature: 'C',
    timeSignature: [4, 4],
    clef: 'treble',
    melody: { measures: [] },
    verses: [],
  };
}

function createSetlist(items: ActiveSetlist['items']): ActiveSetlist {
  return {
    id: 'active-service',
    name: 'Huidige dienst',
    items,
    updatedAt: 100,
  };
}

describe('setlist utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:00:00Z'));
    vi.stubGlobal('window', { localStorage: createLocalStorageMock() });
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('createDefaultActiveSetlist returns the default structure', () => {
    expect(createDefaultActiveSetlist()).toEqual({
      id: 'active-service',
      name: 'Huidige dienst',
      items: [],
      updatedAt: Date.now(),
    });
  });

  it('addSongToSetlist appends items without deduping', () => {
    const base = createDefaultActiveSetlist();
    const withFirst = addSongToSetlist(base, 'song-1', 0);
    const withSecond = addSongToSetlist(withFirst, 'song-2', 2);

    expect(withSecond.items).toHaveLength(2);
    expect(withSecond.items[0].songId).toBe('song-1');
    expect(withSecond.items[1].songId).toBe('song-2');
  });

  it('allows duplicate song ids as separate setlist items', () => {
    const base = createDefaultActiveSetlist();
    const withDuplicates = addSongToSetlist(addSongToSetlist(base, 'song-1', 0), 'song-1', 3);

    expect(withDuplicates.items).toHaveLength(2);
    expect(withDuplicates.items[0].songId).toBe('song-1');
    expect(withDuplicates.items[1].songId).toBe('song-1');
    expect(withDuplicates.items[0].id).not.toBe(withDuplicates.items[1].id);
  });

  it('removeSetlistItem removes only the matching item', () => {
    const setlist = createSetlist([
      { id: 'a', songId: 'song-1', transposeSemitones: 0, createdAt: 1 },
      { id: 'b', songId: 'song-1', transposeSemitones: 2, createdAt: 2 },
      { id: 'c', songId: 'song-2', transposeSemitones: 0, createdAt: 3 },
    ]);

    const result = removeSetlistItem(setlist, 'b');

    expect(result.items.map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('moveSetlistItemUp swaps correctly', () => {
    const setlist = createSetlist([
      { id: 'a', songId: 'song-1', transposeSemitones: 0, createdAt: 1 },
      { id: 'b', songId: 'song-2', transposeSemitones: 0, createdAt: 2 },
      { id: 'c', songId: 'song-3', transposeSemitones: 0, createdAt: 3 },
    ]);

    const result = moveSetlistItemUp(setlist, 'c');

    expect(result.items.map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });

  it('moveSetlistItemDown swaps correctly', () => {
    const setlist = createSetlist([
      { id: 'a', songId: 'song-1', transposeSemitones: 0, createdAt: 1 },
      { id: 'b', songId: 'song-2', transposeSemitones: 0, createdAt: 2 },
      { id: 'c', songId: 'song-3', transposeSemitones: 0, createdAt: 3 },
    ]);

    const result = moveSetlistItemDown(setlist, 'a');

    expect(result.items.map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('moving the top item up does nothing', () => {
    const setlist = createSetlist([
      { id: 'a', songId: 'song-1', transposeSemitones: 0, createdAt: 1 },
      { id: 'b', songId: 'song-2', transposeSemitones: 0, createdAt: 2 },
    ]);

    expect(moveSetlistItemUp(setlist, 'a')).toBe(setlist);
  });

  it('moving the bottom item down does nothing', () => {
    const setlist = createSetlist([
      { id: 'a', songId: 'song-1', transposeSemitones: 0, createdAt: 1 },
      { id: 'b', songId: 'song-2', transposeSemitones: 0, createdAt: 2 },
    ]);

    expect(moveSetlistItemDown(setlist, 'b')).toBe(setlist);
  });

  it('updateSetlistItemTranspose updates only the matching item', () => {
    const setlist = createSetlist([
      { id: 'a', songId: 'song-1', transposeSemitones: 0, createdAt: 1 },
      { id: 'b', songId: 'song-2', transposeSemitones: -1, createdAt: 2 },
    ]);

    const result = updateSetlistItemTranspose(setlist, 'b', 4);

    expect(result.items).toEqual([
      { id: 'a', songId: 'song-1', transposeSemitones: 0, createdAt: 1 },
      { id: 'b', songId: 'song-2', transposeSemitones: 4, createdAt: 2 },
    ]);
  });

  it('getPreviousSetlistItem and getNextSetlistItem handle edges and middle items', () => {
    const setlist = createSetlist([
      { id: 'a', songId: 'song-1', transposeSemitones: 0, createdAt: 1 },
      { id: 'b', songId: 'song-2', transposeSemitones: 0, createdAt: 2 },
      { id: 'c', songId: 'song-3', transposeSemitones: 0, createdAt: 3 },
    ]);

    expect(getPreviousSetlistItem(setlist, 'a')).toBeNull();
    expect(getNextSetlistItem(setlist, 'a')?.id).toBe('b');
    expect(getPreviousSetlistItem(setlist, 'b')?.id).toBe('a');
    expect(getNextSetlistItem(setlist, 'b')?.id).toBe('c');
    expect(getPreviousSetlistItem(setlist, 'c')?.id).toBe('b');
    expect(getNextSetlistItem(setlist, 'c')).toBeNull();
  });

  it('normalizeActiveSetlist discards malformed items and fills safe defaults', () => {
    const result = normalizeActiveSetlist({
      id: 'custom',
      name: '',
      items: [
        { id: 'a', songId: 'song-1', transposeSemitones: 2, createdAt: 10 },
        { id: 'bad', songId: 'song-2', transposeSemitones: '2', createdAt: 11 },
        null,
      ],
      updatedAt: 'oops',
    });

    expect(result.id).toBe('custom');
    expect(result.name).toBe('Huidige dienst');
    expect(result.items).toEqual([{ id: 'a', songId: 'song-1', transposeSemitones: 2, createdAt: 10 }]);
    expect(result.updatedAt).toBeTypeOf('number');
  });

  it('resolveRenderableSetlistItems joins songs in order and skips missing songs', () => {
    const setlist = createSetlist([
      { id: 'a', songId: 'song-2', transposeSemitones: 1, createdAt: 1 },
      { id: 'b', songId: 'missing', transposeSemitones: 0, createdAt: 2 },
      { id: 'c', songId: 'song-1', transposeSemitones: -1, createdAt: 3 },
    ]);
    const songs = [
      createSong('song-1', 1, 'Psalm 1'),
      createSong('song-2', 2, 'Psalm 2'),
    ];

    const result = resolveRenderableSetlistItems(setlist, songs);

    expect(result.map(({ item }) => item.id)).toEqual(['a', 'c']);
    expect(result.map(({ song }) => song.title)).toEqual(['Psalm 2', 'Psalm 1']);
  });

  it('clearSetlist empties items and preserves basic structure', () => {
    const setlist = createSetlist([
      { id: 'a', songId: 'song-1', transposeSemitones: 0, createdAt: 1 },
    ]);

    const result = clearSetlist(setlist);

    expect(result.id).toBe(setlist.id);
    expect(result.name).toBe(setlist.name);
    expect(result.items).toEqual([]);
    expect(result.updatedAt).toBeGreaterThan(setlist.updatedAt);
  });

  it('loadActiveSetlist falls back safely for malformed storage payloads', () => {
    window.localStorage.setItem(ACTIVE_SETLIST_STORAGE_KEY, '{not valid json');

    expect(loadActiveSetlist()).toEqual({
      id: 'active-service',
      name: 'Huidige dienst',
      items: [],
      updatedAt: Date.now(),
    });
  });

  it('saveActiveSetlist persists the full setlist JSON', () => {
    const setlist = createSetlist([
      { id: 'a', songId: 'song-1', transposeSemitones: 2, createdAt: 1 },
    ]);

    saveActiveSetlist(setlist);

    expect(JSON.parse(window.localStorage.getItem(ACTIVE_SETLIST_STORAGE_KEY) || 'null')).toEqual(setlist);
  });
});
