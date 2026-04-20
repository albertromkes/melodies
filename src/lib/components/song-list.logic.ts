import type MiniSearch from 'minisearch';
import type { PsalmData } from '../types/music';
import type { SongMeta, SongSearchResult, SongVerseMatch } from '../types';
import { normalizeSearchText, parseSearchQueryWithPhrases } from '../utils/search';

interface VerseSearchResult {
  songId: string;
  verseNumber: number;
  text: string;
  lines: string[];
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

const MAX_SNIPPET_LENGTH = 96;

function getSnippetTerms(remainder: string, phrases: string[]): string[] {
  const tokens = remainder
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);

  return Array.from(new Set([...phrases, ...tokens]));
}

function getLineMatchScore(line: string, terms: string[]): number {
  const normalizedLine = normalizeSearchText(line);
  return terms.reduce((score, term) => {
    if (!term || !normalizedLine.includes(term)) {
      return score;
    }

    return score + (term.includes(' ') ? 4 : 2);
  }, 0);
}

function truncateSnippet(line: string): string {
  const trimmedLine = line.trim();
  if (trimmedLine.length <= MAX_SNIPPET_LENGTH) {
    return trimmedLine;
  }

  return `${trimmedLine.slice(0, MAX_SNIPPET_LENGTH - 1).trimEnd()}…`;
}

function buildVerseSnippet(lines: string[], terms: string[]): string {
  const candidates = lines
    .filter((line) => typeof line === 'string')
    .map((line) => line.trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    return '';
  }

  if (terms.length === 0) {
    return truncateSnippet(candidates[0]);
  }

  let bestLine = candidates[0];
  let bestScore = -1;

  candidates.forEach((line) => {
    const score = getLineMatchScore(line, terms);
    if (score > bestScore) {
      bestLine = line;
      bestScore = score;
    }
  });

  return truncateSnippet(bestLine);
}

export function filterSongs({
  songs,
  categoryFilteredSongs,
  songsMeta,
  searchQuery,
  searchInVerses,
  useFuzzyVerseSearch,
  versesIndex,
}: FilterSongsParams): SongSearchResult[] {
  const queryRaw = searchQuery.trim();
  const query = queryRaw.toLowerCase();

  if (!query) {
    return categoryFilteredSongs.map((song) => ({ song, matchedVerses: [] }));
  }

  const matchingIds = new Set<string>();
  const verseMatchesBySongId = new Map<string, Map<number, SongVerseMatch>>();

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
    const snippetTerms = getSnippetTerms(remainder, phrases);

    if (seed) {
      const results = versesIndex.search(seed, { prefix: true, fuzzy: useFuzzyVerseSearch ? 0.2 : 0 }) as unknown as VerseSearchResult[];
      results.forEach((result) => {
        const haystack = typeof result.text === 'string' ? result.text : '';
        const matchesAllPhrases = phrases.every((phrase) => haystack.includes(phrase));
        if (!matchesAllPhrases || typeof result.verseNumber !== 'number') {
          return;
        }

        matchingIds.add(result.songId);

        let songMatches = verseMatchesBySongId.get(result.songId);
        if (!songMatches) {
          songMatches = new Map<number, SongVerseMatch>();
          verseMatchesBySongId.set(result.songId, songMatches);
        }

        if (!songMatches.has(result.verseNumber)) {
          const lines = Array.isArray(result.lines) ? result.lines : [];
          songMatches.set(result.verseNumber, {
            verseNumber: result.verseNumber,
            snippet: buildVerseSnippet(lines, snippetTerms),
          });
        }
      });
    }
  }

  songs.forEach((song) => {
    if (song.title.toLowerCase().includes(query)) {
      matchingIds.add(song.id);
    }
  });

  return categoryFilteredSongs
    .filter((song) => matchingIds.has(song.id))
    .map((song) => ({
      song,
      matchedVerses: Array.from(verseMatchesBySongId.get(song.id)?.values() ?? []).sort(
        (left, right) => left.verseNumber - right.verseNumber
      ),
    }));
}
