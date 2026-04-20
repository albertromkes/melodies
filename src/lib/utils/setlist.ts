import type { PsalmData } from '../types/music';
import type { ActiveSetlist, SetlistItem } from '../types/setlist';

export const ACTIVE_SETLIST_STORAGE_KEY = 'melodies.active-setlist.v1';

function createUpdatedSetlist(setlist: ActiveSetlist, items: SetlistItem[]): ActiveSetlist {
  return {
    ...setlist,
    items,
    updatedAt: Date.now(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidSetlistItem(value: unknown): value is SetlistItem {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.songId === 'string'
    && typeof value.transposeSemitones === 'number'
    && Number.isFinite(value.transposeSemitones)
    && typeof value.createdAt === 'number'
    && Number.isFinite(value.createdAt);
}

export function createDefaultActiveSetlist(): ActiveSetlist {
  return {
    id: 'active-service',
    name: 'Huidige dienst',
    items: [],
    updatedAt: Date.now(),
  };
}

export function normalizeActiveSetlist(input: unknown): ActiveSetlist {
  const fallback = createDefaultActiveSetlist();

  if (!isRecord(input)) {
    return fallback;
  }

  const items = Array.isArray(input.items) ? input.items.filter(isValidSetlistItem) : [];

  return {
    id: typeof input.id === 'string' && input.id.trim() ? input.id : fallback.id,
    name: typeof input.name === 'string' && input.name.trim() ? input.name : fallback.name,
    items,
    updatedAt: typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
      ? input.updatedAt
      : fallback.updatedAt,
  };
}

export function loadActiveSetlist(): ActiveSetlist {
  if (typeof window === 'undefined') {
    return createDefaultActiveSetlist();
  }

  const saved = window.localStorage.getItem(ACTIVE_SETLIST_STORAGE_KEY);
  if (!saved) {
    return createDefaultActiveSetlist();
  }

  try {
    return normalizeActiveSetlist(JSON.parse(saved));
  } catch {
    return createDefaultActiveSetlist();
  }
}

export function saveActiveSetlist(setlist: ActiveSetlist): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ACTIVE_SETLIST_STORAGE_KEY, JSON.stringify(setlist));
}

export function createSetlistItem(songId: string, transposeSemitones: number): SetlistItem {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `setlist-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id,
    songId,
    transposeSemitones,
    createdAt: Date.now(),
  };
}

export function addSongToSetlist(
  setlist: ActiveSetlist,
  songId: string,
  transposeSemitones: number
): ActiveSetlist {
  return createUpdatedSetlist(setlist, [...setlist.items, createSetlistItem(songId, transposeSemitones)]);
}

export function removeSetlistItem(setlist: ActiveSetlist, itemId: string): ActiveSetlist {
  const items = setlist.items.filter((item) => item.id !== itemId);
  return items.length === setlist.items.length ? setlist : createUpdatedSetlist(setlist, items);
}

export function moveSetlistItemUp(setlist: ActiveSetlist, itemId: string): ActiveSetlist {
  const index = getSetlistItemIndex(setlist, itemId);
  if (index <= 0) {
    return setlist;
  }

  const items = [...setlist.items];
  [items[index - 1], items[index]] = [items[index], items[index - 1]];
  return createUpdatedSetlist(setlist, items);
}

export function moveSetlistItemDown(setlist: ActiveSetlist, itemId: string): ActiveSetlist {
  const index = getSetlistItemIndex(setlist, itemId);
  if (index < 0 || index >= setlist.items.length - 1) {
    return setlist;
  }

  const items = [...setlist.items];
  [items[index], items[index + 1]] = [items[index + 1], items[index]];
  return createUpdatedSetlist(setlist, items);
}

export function updateSetlistItemTranspose(
  setlist: ActiveSetlist,
  itemId: string,
  transposeSemitones: number
): ActiveSetlist {
  let changed = false;

  const items = setlist.items.map((item) => {
    if (item.id !== itemId || item.transposeSemitones === transposeSemitones) {
      return item;
    }

    changed = true;
    return { ...item, transposeSemitones };
  });

  return changed ? createUpdatedSetlist(setlist, items) : setlist;
}

export function clearSetlist(setlist: ActiveSetlist): ActiveSetlist {
  return {
    ...setlist,
    items: [],
    updatedAt: Date.now(),
  };
}

export function getSetlistItemIndex(setlist: ActiveSetlist, itemId: string): number {
  return setlist.items.findIndex((item) => item.id === itemId);
}

export function getPreviousSetlistItem(setlist: ActiveSetlist, itemId: string): SetlistItem | null {
  const index = getSetlistItemIndex(setlist, itemId);
  return index > 0 ? setlist.items[index - 1] : null;
}

export function getNextSetlistItem(setlist: ActiveSetlist, itemId: string): SetlistItem | null {
  const index = getSetlistItemIndex(setlist, itemId);
  return index >= 0 && index < setlist.items.length - 1 ? setlist.items[index + 1] : null;
}

export function resolveRenderableSetlistItems(
  setlist: ActiveSetlist,
  songs: PsalmData[]
): Array<{ item: SetlistItem; song: PsalmData }> {
  const songsById = new Map(songs.map((song) => [song.id, song]));

  return setlist.items.reduce<Array<{ item: SetlistItem; song: PsalmData }>>((result, item) => {
    const song = songsById.get(item.songId);
    if (song) {
      result.push({ item, song });
    }
    return result;
  }, []);
}
