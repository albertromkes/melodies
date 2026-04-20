<script lang="ts">
  import type { PsalmData } from '../types/music';
  import type { Category, SongSearchResult, SongSelectionOptions } from '../types';
  import { isPrimaryCategory } from '../data/category-utils';

  const DEFAULT_VISIBLE_VERSES = 3;

  interface Props {
    filteredSongs: SongSearchResult[];
    searchQuery: string;
    selectedCategory: string | null;
    categories: Category[];
    onSelectSong: (song: PsalmData, options?: SongSelectionOptions) => void;
  }

  let { filteredSongs, searchQuery, selectedCategory, categories, onSelectSong }: Props = $props();
  let expandedSongs = $state<Record<string, boolean>>({});

  function getCategoryName(categoryId: string): string {
    const category = categories.find((entry) => entry.id === categoryId);
    return category?.name || categoryId;
  }

  function isExpanded(songId: string): boolean {
    return expandedSongs[songId] === true;
  }

  function toggleExpanded(songId: string) {
    expandedSongs = {
      ...expandedSongs,
      [songId]: !expandedSongs[songId],
    };
  }

  function getVisibleVerseCount(songId: string, matchCount: number): number {
    if (isExpanded(songId)) {
      return matchCount;
    }

    return Math.min(DEFAULT_VISIBLE_VERSES, matchCount);
  }
</script>

<div class="songs-grid">
  {#each filteredSongs as result (result.song.id)}
    {@const song = result.song}
    {@const visibleVerseCount = getVisibleVerseCount(song.id, result.matchedVerses.length)}
    <article class="song-card">
      <button
        class="song-button"
        onclick={() => onSelectSong(song)}
      >
        <span class="song-number">{song.number}</span>
        <div class="song-info">
          <span class="song-title">{song.title}</span>
          {#if !selectedCategory && song.category && !isPrimaryCategory(song.category)}
            <span class="song-category">{getCategoryName(song.category)}</span>
          {/if}
        </div>
        {#if song.mode}
          <span class="song-mode">{song.mode}</span>
        {/if}
      </button>

      {#if result.matchedVerses.length > 0}
        <div class="verse-match-list" aria-label={`Gevonden verzen voor ${song.title}`}>
          {#each result.matchedVerses.slice(0, visibleVerseCount) as match (match.verseNumber)}
            <button
              class="verse-match-button"
              onclick={() => onSelectSong(song, { initialVerseNumber: match.verseNumber })}
            >
              <span class="verse-match-label">Vers {match.verseNumber}</span>
              <span class="verse-match-snippet">{match.snippet}</span>
            </button>
          {/each}

          {#if result.matchedVerses.length > DEFAULT_VISIBLE_VERSES}
            <button
              class="toggle-more-button"
              onclick={() => toggleExpanded(song.id)}
            >
              {#if isExpanded(song.id)}
                Toon minder
              {:else}
                Toon meer
              {/if}
            </button>
          {/if}
        </div>
      {/if}
    </article>
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

<style>
  .songs-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .song-card {
    display: flex;
    flex-direction: column;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .song-button {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: transparent;
    border: 0;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }

  .song-button:hover {
    background: var(--card-hover-bg);
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

  @media (min-width: 480px) {
    .song-mode {
      display: block;
    }
  }

  .verse-match-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0 0.75rem 0.75rem;
  }

  .verse-match-button {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.75rem;
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-color);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.2s, background 0.2s;
  }

  .verse-match-button:hover {
    border-color: var(--primary-color);
    background: var(--card-hover-bg);
  }

  .verse-match-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--primary-color);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .verse-match-snippet {
    font-size: 0.9rem;
    line-height: 1.4;
    color: var(--text-color);
  }

  .toggle-more-button {
    align-self: flex-start;
    padding: 0.4rem 0.75rem;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    color: var(--muted-color);
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
  }

  .toggle-more-button:hover {
    border-color: var(--primary-color);
    color: var(--text-color);
  }

  .no-results {
    text-align: center;
    color: var(--muted-color);
    padding: 2rem;
  }

  @media (max-width: 640px) {
    .song-button {
      padding: 0.85rem;
    }

    .verse-match-list {
      padding: 0 0.6rem 0.6rem;
    }

    .verse-match-button {
      padding: 0.65rem;
    }

    .verse-match-snippet {
      font-size: 0.85rem;
    }
  }
</style>
