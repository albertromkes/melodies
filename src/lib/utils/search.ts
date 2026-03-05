export function normalizeSearchText(value: string): string {
  return (value ?? '')
    .toString()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSearchQueryWithPhrases(input: string): { remainder: string; phrases: string[] } {
  const raw = input ?? '';
  const phrases: string[] = [];
  const patterns = [/"([^"]+)"/g, /“([^”]+)”/g];

  let remainder = raw;
  for (const pattern of patterns) {
    remainder = remainder.replace(pattern, (_match, group: string) => {
      const normalized = normalizeSearchText(group);
      if (normalized) phrases.push(normalized);
      return ' ';
    });
  }

  return {
    remainder: normalizeSearchText(remainder),
    phrases,
  };
}

export function detectNumericSearchType(
  query: string,
  numbersInCurrentScope: number[],
  numbersInAllSongs: number[]
): 'number' | 'text' {
  const trimmed = query.trim();
  if (!/^\d+$/.test(trimmed)) return 'text';

  const hasScopedMatch = numbersInCurrentScope.some((number) => number.toString().startsWith(trimmed));
  if (hasScopedMatch) return 'number';

  const hasGlobalMatch = numbersInAllSongs.some((number) => number.toString().startsWith(trimmed));
  return hasGlobalMatch ? 'number' : 'text';
}
