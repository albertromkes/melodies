<script lang="ts">
  import type { VerseLyrics } from '../types/music';

  interface Props {
    verses: VerseLyrics[];
    activeVerseNumber: number;
    showLyrics: boolean;
    onVerseChange: (verseNumber: number) => void;
    onToggleLyrics: (show: boolean) => void;
  }

  let { verses, activeVerseNumber, showLyrics, onVerseChange, onToggleLyrics }: Props = $props();

  // Get all verse numbers
  let allVerseNumbers = $derived.by<number[]>(() => {
    return verses.map(v => v.number).sort((a, b) => a - b);
  });

  // Get current lyrics based on active verse
  let verseLyrics = $derived.by<string[]>(() => {
    const verse = verses.find(v => v.number === activeVerseNumber);
    if (verse) {
      return verse.lines.filter(line => line);
    }
    return [];
  });
  
  let totalVerses = $derived(allVerseNumbers.length);
</script>

<div class="verse-selector">
  <div class="verse-header">
    <h3>Lyrics</h3>
    <label class="toggle-label">
      <input
        type="checkbox"
        checked={showLyrics}
        onchange={(e) => onToggleLyrics(e.currentTarget.checked)}
      />
      Show on staff
    </label>
  </div>

  {#if totalVerses > 0}
    <div class="verse-buttons">
      {#each allVerseNumbers as verseNum (verseNum)}
        <button
          class="verse-btn"
          class:active={activeVerseNumber === verseNum}
          onclick={() => onVerseChange(verseNum)}
        >
          Verse {verseNum}
        </button>
      {/each}
    </div>

    {#if verseLyrics.length > 0}
      <div class="verse-text">
        {#each verseLyrics as line}
          <p>{line}</p>
        {/each}
      </div>
    {/if}
  {:else}
    <p class="no-verses">No verses available for this psalm.</p>
  {/if}
</div>

<style>
  .verse-selector {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--card-bg);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .verse-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .verse-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-color);
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--muted-color);
    cursor: pointer;
  }

  .toggle-label input {
    cursor: pointer;
  }

  .verse-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .verse-btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-color);
    color: var(--text-color);
    cursor: pointer;
    transition: all 0.2s;
  }

  .verse-btn:hover {
    border-color: var(--primary-color);
  }

  .verse-btn.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }

  .verse-text {
    padding: 0.75rem;
    background: var(--bg-color);
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .verse-text p {
    margin: 0;
    font-size: 1rem;
    line-height: 1.6;
    color: var(--text-color);
  }

  .no-verses {
    color: var(--muted-color);
    font-style: italic;
  }
</style>
