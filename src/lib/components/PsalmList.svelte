<script lang="ts">
  import MiniSearch from 'minisearch';
  import type { PsalmData } from '../types/music';

  /** Psalm metadata for search (from psalms-meta.json) */
  interface PsalmMeta {
    id: string;
    number: number;
    title: string;
    tags: string[];
  }

  interface Props {
    psalms: PsalmData[];
    searchQuery: string;
    onSelectPsalm: (psalm: PsalmData) => void;
    onSearchChange: (query: string) => void;
  }

  let { psalms, searchQuery, onSelectPsalm, onSearchChange }: Props = $props();

  // Search state
  let searchInVerses = $state(false);
  let useFuzzyVerseSearch = $state(false);
  let psalmsMeta = $state<PsalmMeta[]>([]);
  let versesIndex = $state<MiniSearch | null>(null);
  let versesIndexLoading = $state(false);

  // Load metadata index on mount
  $effect(() => {
    fetch('/search/psalms-meta.json')
      .then(res => res.json())
      .then(data => { psalmsMeta = data; })
      .catch(err => console.warn('Failed to load search metadata:', err));
  });

  // Lazy-load verses index when checkbox enabled
  $effect(() => {
    if (searchInVerses && !versesIndex && !versesIndexLoading) {
      versesIndexLoading = true;
      fetch('/search/verses-index.json')
        .then(res => res.text())
        .then(data => {
          versesIndex = MiniSearch.loadJSON(data, {
            fields: ['text'],
            storeFields: ['psalmId', 'psalmNumber', 'text'],
            idField: 'docId',
          });
          versesIndexLoading = false;
        })
        .catch(err => {
          console.warn('Failed to load verses index:', err);
          versesIndexLoading = false;
        });
    }
  });

  function normalizeText(s: string): string {
    return (s ?? '')
      .toString()
      .toLowerCase()
      .replace(/[’']/g, "'")
      // Keep letters/numbers/spaces/hyphen; drop punctuation/symbols
      .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseQueryWithPhrases(input: string): { remainder: string; phrases: string[] } {
    const raw = input ?? '';
    const phrases: string[] = [];

    // Support straight quotes "..." and curly quotes “...”
    const patterns = [/"([^"]+)"/g, /“([^”]+)”/g];

    let remainder = raw;
    for (const re of patterns) {
      remainder = remainder.replace(re, (_m, g1: string) => {
        const phrase = normalizeText(g1);
        if (phrase) phrases.push(phrase);
        return ' ';
      });
    }

    return { remainder: normalizeText(remainder), phrases };
  }

  let filteredPsalms = $derived.by(() => {
    const queryRaw = searchQuery.trim();
    const query = queryRaw.toLowerCase();
    if (!query) return psalms;

    // Get matching psalm IDs from different search methods
    const matchingIds = new Set<string>();

    // Always search by number
    psalms.forEach(psalm => {
      if (psalm.number.toString().includes(searchQuery)) {
        matchingIds.add(psalm.id);
      }
    });

    // Search tags from metadata
    psalmsMeta.forEach(meta => {
      if (meta.tags.some(tag => tag.toLowerCase().includes(query))) {
        matchingIds.add(meta.id);
      }
    });

    // Search in verses if enabled and index loaded
    if (searchInVerses && versesIndex) {
      const { remainder, phrases } = parseQueryWithPhrases(queryRaw);
      const seed = remainder || phrases.join(' ');

      const results = versesIndex.search(seed, { prefix: true, fuzzy: useFuzzyVerseSearch ? 0.2 : 0 });
      results.forEach(result => {
        if (!phrases.length) {
          matchingIds.add(result.psalmId);
          return;
        }

        const haystack = typeof result.text === 'string' ? result.text : '';
        const matchesAllPhrases = phrases.every(p => haystack.includes(p));
        if (matchesAllPhrases) {
          matchingIds.add(result.psalmId);
        }
      });
    }

    // Also check title (always)
    psalms.forEach(psalm => {
      if (psalm.title.toLowerCase().includes(query)) {
        matchingIds.add(psalm.id);
      }
    });

    return psalms.filter(psalm => matchingIds.has(psalm.id));
  });
</script>

<div class="psalm-list">
  <div class="search-container">
    <input
      type="search"
      placeholder="Search by number, title{searchInVerses ? ', or verse text' : ', or tags'}..."
      value={searchQuery}
      oninput={(e) => onSearchChange(e.currentTarget.value)}
      class="search-input"
    />
    <label class="checkbox-label">
      <input
        type="checkbox"
        bind:checked={searchInVerses}
      />
      <span>Search in verses</span>
      {#if versesIndexLoading}
        <span class="loading-indicator">⏳</span>
      {/if}
    </label>

    {#if searchInVerses}
      <label class="checkbox-label">
        <input
          type="checkbox"
          bind:checked={useFuzzyVerseSearch}
          disabled={versesIndexLoading}
        />
        <span>Fuzzy</span>
      </label>
    {/if}
  </div>

  <div class="psalms-grid">
    {#each filteredPsalms as psalm (psalm.id)}
      <button
        class="psalm-button"
        onclick={() => onSelectPsalm(psalm)}
      >
        <span class="psalm-number">{psalm.number}</span>
        <span class="psalm-title">{psalm.title}</span>
        {#if psalm.mode}
          <span class="psalm-mode">{psalm.mode}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if filteredPsalms.length === 0}
    <p class="no-results">No psalms found matching "{searchQuery}"</p>
  {/if}
</div>

<style>
  .psalm-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .search-container {
    position: sticky;
    top: 0;
    background: var(--bg-color);
    padding: 0.5rem 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border: 2px solid var(--border-color);
    border-radius: 8px;
    background: var(--input-bg);
    color: var(--text-color);
    transition: border-color 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--muted-color);
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
    accent-color: var(--primary-color);
  }

  .loading-indicator {
    font-size: 0.75rem;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .psalms-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .psalm-button {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }

  .psalm-button:hover {
    background: var(--card-hover-bg);
    border-color: var(--primary-color);
    transform: translateY(-1px);
  }

  .psalm-button:active {
    transform: translateY(0);
  }

  .psalm-number {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--primary-color);
    min-width: 3rem;
  }

  .psalm-title {
    flex: 1;
    font-size: 1rem;
    color: var(--text-color);
  }

  .psalm-mode {
    font-size: 0.75rem;
    color: var(--muted-color);
    background: var(--tag-bg);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .no-results {
    text-align: center;
    color: var(--muted-color);
    padding: 2rem;
  }
</style>
