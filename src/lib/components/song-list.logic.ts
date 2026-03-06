import type MiniSearch from 'minisearch';
import type { PsalmData } from '../types/music';
import type { SongMeta } from '../types';
import { parseSearchQueryWithPhrases } from '../utils/search';

interface VerseSearchResult {
  songId: string;
  text: string;
}

interface FilterSongsParams {
  songs: PsalmData[];
  categoryFilteredSongs: PsalmData[];
  songsMeta: SongMeta[];
  searchQuery: string;
  searchInVerses: boolean;
  useFuzzyVerseSearch: boolean;
  versesIndex: MiniSearch | null;
}

export function filterSongs({
  songs,
  categoryFilteredSongs,
  songsMeta,
  searchQuery,
  searchInVerses,
  useFuzzyVerseSearch,
  versesIndex,
}: FilterSongsParams): PsalmData[] {
  const queryRaw = searchQuery.trim();
  const query = queryRaw.toLowerCase();

  if (!query) return categoryFilteredSongs;

  const matchingIds = new Set<string>();

  songs.forEach((song) => {
    if (song.number.toString().includes(queryRaw)) {
      matchingIds.add(song.id);
    }
  });

  songsMeta.forEach((meta) => {
    if (meta.tags.some((tag) => tag.toLowerCase().includes(query))) {
      matchingIds.add(meta.id);
    }
  });

  if (searchInVerses && versesIndex) {
    const { remainder, phrases } = parseSearchQueryWithPhrases(queryRaw);
    const seed = remainder || phrases.join(' ');

    const results = versesIndex.search(seed, { prefix: true, fuzzy: useFuzzyVerseSearch ? 0.2 : 0 }) as unknown as VerseSearchResult[];
    results.forEach((result) => {
      if (!phrases.length) {
        matchingIds.add(result.songId);
        return;
      }

      const haystack = typeof result.text === 'string' ? result.text : '';
      const matchesAllPhrases = phrases.every((phrase) => haystack.includes(phrase));
      if (matchesAllPhrases) {
        matchingIds.add(result.songId);
      }
    });
  }

  songs.forEach((song) => {
    if (song.title.toLowerCase().includes(query)) {
      matchingIds.add(song.id);
    }
  });

  return categoryFilteredSongs.filter((song) => matchingIds.has(song.id));
}
