<script lang="ts">
  import type { PsalmData } from '../types/music';
  import type { Category } from '../types';
  import { isPrimaryCategory } from '../data/category-utils';

  interface Props {
    filteredSongs: PsalmData[];
    searchQuery: string;
    selectedCategory: string | null;
    categories: Category[];
    onSelectSong: (song: PsalmData) => void;
  }

  let { filteredSongs, searchQuery, selectedCategory, categories, onSelectSong }: Props = $props();

  function getCategoryName(categoryId: string): string {
    const category = categories.find((entry) => entry.id === categoryId);
    return category?.name || categoryId;
  }
</script>

<div class="songs-grid">
  {#each filteredSongs as song (song.id)}
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
