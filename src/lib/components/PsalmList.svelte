<script lang="ts">
  import type { PsalmData } from '../types/music';

  interface Props {
    psalms: PsalmData[];
    searchQuery: string;
    onSelectPsalm: (psalm: PsalmData) => void;
    onSearchChange: (query: string) => void;
  }

  let { psalms, searchQuery, onSelectPsalm, onSearchChange }: Props = $props();

  let filteredPsalms = $derived(
    searchQuery.trim()
      ? psalms.filter(psalm => {
          const query = searchQuery.toLowerCase();
          // Match by number
          if (psalm.number.toString().includes(searchQuery)) return true;
          // Match by title
          if (psalm.title.toLowerCase().includes(query)) return true;
          // Match in verses syllables
          return psalm.verses.some(v => 
            v.syllables?.join(' ').toLowerCase().includes(query)
          );
        })
      : psalms
  );
</script>

<div class="psalm-list">
  <div class="search-container">
    <input
      type="search"
      placeholder="Search by number, title, or text..."
      value={searchQuery}
      oninput={(e) => onSearchChange(e.currentTarget.value)}
      class="search-input"
    />
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
