<script lang="ts">
  import type { VerseLyrics } from '../types/music';

  interface Props {
    verses: VerseLyrics[];
    activeVerseNumber: number;
    showLyrics: boolean;
    showChords: boolean;
    hasChords: boolean;
    onVerseChange: (verseNumber: number) => void;
    onToggleLyrics: (show: boolean) => void;
    onToggleChords: (show: boolean) => void;
  }

  let { verses, activeVerseNumber, showLyrics, showChords, hasChords, onVerseChange, onToggleLyrics, onToggleChords }: Props = $props();

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
    <h3>Tekst</h3>
    <div class="toggle-group">
      <label class="toggle-label">
        <input
          type="checkbox"
          checked={showLyrics}
          onchange={(e) => onToggleLyrics(e.currentTarget.checked)}
        />
        Toon tekst
      </label>
      {#if hasChords}
        <label class="toggle-label">
          <input
            type="checkbox"
            checked={showChords}
            onchange={(e) => onToggleChords(e.currentTarget.checked)}
          />
          Toon akkoorden
        </label>
      {/if}
    </div>
  </div>

  {#if totalVerses > 0}
    <div class="verse-buttons">
      {#each allVerseNumbers as verseNum (verseNum)}
        <button
          class="verse-btn"
          class:active={activeVerseNumber === verseNum}
          onclick={() => onVerseChange(verseNum)}
        >
          Vers {verseNum}
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
    <p class="no-verses">Geen verzen beschikbaar.</p>
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

  .toggle-group {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
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

  /* Mobile optimizations */
  @media (max-width: 640px) {
    .verse-selector {
      gap: 0.5rem;
      padding: 0.5rem;
    }

    .verse-header h3 {
      font-size: 0.875rem;
    }

    .toggle-label {
      font-size: 0.75rem;
      gap: 0.25rem;
    }

    .verse-buttons {
      gap: 0.25rem;
    }

    .verse-btn {
      padding: 0.3rem 0.6rem;
      font-size: 0.75rem;
    }

    .verse-text {
      padding: 0.5rem;
    }

    .verse-text p {
      font-size: 0.875rem;
      line-height: 1.4;
    }
  }
</style>
