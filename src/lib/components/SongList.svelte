<script lang="ts">
  import MiniSearch from 'minisearch';
  import type { PsalmData } from '../types/music';
  import type { Category, SongMeta } from '../types';

  interface Props {
    songs: PsalmData[];
    categories: Category[];
    selectedCategory: string | null; // null means "all"
    searchQuery: string;
    searchInVerses: boolean;
    useFuzzyVerseSearch: boolean;
    onSelectSong: (song: PsalmData) => void;
    onSelectCategory: (categoryId: string | null) => void;
    onSearchChange: (query: string) => void;
    onSearchInVersesChange: (value: boolean) => void;
    onUseFuzzyChange: (value: boolean) => void;
    onOpenSettings: () => void;
  }

  let {
    songs,
    categories,
    selectedCategory,
    searchQuery,
    searchInVerses,
    useFuzzyVerseSearch,
    onSelectSong,
    onSelectCategory,
    onSearchChange,
    onSearchInVersesChange,
    onUseFuzzyChange,
    onOpenSettings
  }: Props = $props();
  
  let songsMeta = $state<SongMeta[]>([]);
  let versesIndex = $state<MiniSearch | null>(null);
  let versesIndexLoading = $state(false);

  // Load metadata index on mount
  $effect(() => {
    fetch('/search/songs-meta.json')
      .then(res => res.json())
      .then(data => { songsMeta = data; })
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
            storeFields: ['songId', 'songNumber', 'category', 'text'],
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
      .replace(/['']/g, "'")
      .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseQueryWithPhrases(input: string): { remainder: string; phrases: string[] } {
    const raw = input ?? '';
    const phrases: string[] = [];

    const patterns = [/"([^"]+)"/g, /"([^"]+)"/g];

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

  // Filter songs based on selected category (before search)
  let categoryFilteredSongs = $derived.by(() => {
    if (!selectedCategory) return songs;
    return songs.filter(song => (song.category || 'psalms') === selectedCategory);
  });

  let filteredSongs = $derived.by(() => {
    const queryRaw = searchQuery.trim();
    const query = queryRaw.toLowerCase();
    
    // If no search query, return category-filtered songs
    if (!query) return categoryFilteredSongs;

    // Get matching song IDs from different search methods
    const matchingIds = new Set<string>();

    // Always search by number
    songs.forEach(song => {
      if (song.number.toString().includes(searchQuery)) {
        matchingIds.add(song.id);
      }
    });

    // Search tags from metadata
    songsMeta.forEach(meta => {
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
          matchingIds.add(result.songId);
          return;
        }

        const haystack = typeof result.text === 'string' ? result.text : '';
        const matchesAllPhrases = phrases.every(p => haystack.includes(p));
        if (matchesAllPhrases) {
          matchingIds.add(result.songId);
        }
      });
    }

    // Also check title (always)
    songs.forEach(song => {
      if (song.title.toLowerCase().includes(query)) {
        matchingIds.add(song.id);
      }
    });

    // Apply category filter to search results
    return categoryFilteredSongs.filter(song => matchingIds.has(song.id));
  });

  // Get display name for category
  function getCategoryName(categoryId: string): string {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || categoryId;
  }
</script>

<div class="song-list">
  <!-- Category selector - only show if more than one category -->
  {#if categories.length > 1}
    <div class="category-selector">
      {#each categories as category (category.id)}
        <button
          class="category-button"
          class:selected={selectedCategory === category.id}
          onclick={() => onSelectCategory(category.id)}
      >
        {category.name}
        <span class="category-count">{category.count}</span>
      </button>
    {/each}
  </div>
  {/if}

  <!-- Search container -->
  <div class="search-container">
    <div class="search-header">
      <button class="settings-button" onclick={onOpenSettings} aria-label="Instellingen">
        ⚙️
      </button>
    </div>
    <input
      type="search"
      placeholder="Zoek op nummer, titel{searchInVerses ? ', of verstekst' : ', of tags'}..."
      value={searchQuery}
      oninput={(e) => onSearchChange(e.currentTarget.value)}
      class="search-input"
    />
    
    <div class="search-options">
      <label class="checkbox-label">
        <input
          type="checkbox"
          checked={searchInVerses}
          onchange={(e) => onSearchInVersesChange(e.currentTarget.checked)}
        />
        <span>Zoek in verzen</span>
        {#if versesIndexLoading}
          <span class="loading-indicator">⏳</span>
        {/if}
      </label>

      {#if searchInVerses}
        <label class="checkbox-label">
          <input
            type="checkbox"
            checked={useFuzzyVerseSearch}
            onchange={(e) => onUseFuzzyChange(e.currentTarget.checked)}
            disabled={versesIndexLoading}
          />
          <span>Fuzzy</span>
        </label>
      {/if}
    </div>
    
    {#if searchQuery && !selectedCategory}
      <p class="search-hint">Zoeken in alle categorieën</p>
    {/if}
  </div>

  <!-- Songs grid -->
  <div class="songs-grid">
    {#each filteredSongs as song (song.id)}
      <button
        class="song-button"
        onclick={() => onSelectSong(song)}
      >
        <span class="song-number">{song.number}</span>
        <div class="song-info">
          <span class="song-title">{song.title}</span>
          {#if !selectedCategory && song.category && song.category !== 'psalms'}
            <span class="song-category">{getCategoryName(song.category)}</span>
          {/if}
        </div>
        {#if song.mode}
          <span class="song-mode">{song.mode}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if filteredSongs.length === 0}
    <p class="no-results">
      {#if searchQuery}
        Geen liederen gevonden voor "{searchQuery}"
        {#if selectedCategory}
          in {getCategoryName(selectedCategory)}
        {/if}
      {:else}
        Geen liederen in deze categorie
      {/if}
    </p>
  {/if}
</div>

<style>
  .song-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .category-selector {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .category-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.9375rem;
    font-weight: 500;
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    color: var(--text-color);
    transition: all 0.2s;
    min-height: 44px;
  }

  .category-button:hover {
    background: var(--card-hover-bg);
    border-color: var(--primary-color);
  }

  .category-button.selected {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }

  .category-count {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }

  .category-button.selected .category-count {
    background: rgba(255, 255, 255, 0.2);
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

  .search-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.5rem;
  }

  .settings-button {
    width: 44px;
    height: 44px;
    border: 1px solid var(--border-color);
    border-radius: 50%;
    background: var(--card-bg);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    font-size: 1.25rem;
  }

  .settings-button:hover {
    border-color: var(--primary-color);
    transform: scale(1.05);
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

  .search-options {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
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

  .search-hint {
    font-size: 0.75rem;
    color: var(--muted-color);
    margin: 0;
  }

  .loading-indicator {
    font-size: 0.75rem;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .songs-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .song-button {
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

  .song-button:hover {
    background: var(--card-hover-bg);
    border-color: var(--primary-color);
    transform: translateY(-1px);
  }

  .song-button:active {
    transform: translateY(0);
  }

  .song-number {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--primary-color);
    min-width: 3rem;
  }

  .song-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .song-title {
    font-size: 1rem;
    color: var(--text-color);
  }

  .song-category {
    font-size: 0.75rem;
    color: var(--muted-color);
  }

  .song-mode {
    font-size: 0.75rem;
    color: var(--muted-color);
    background: var(--tag-bg);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    display: none;
  }

  /* Show mode on larger screens */
  @media (min-width: 480px) {
    .song-mode {
      display: block;
    }
  }

  .no-results {
    text-align: center;
    color: var(--muted-color);
    padding: 2rem;
  }
</style>
