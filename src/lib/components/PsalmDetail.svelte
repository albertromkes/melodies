<script lang="ts">
  import type { PsalmData, Measure, VerseLyrics } from '../types/music';
  import StaffDisplay from './StaffDisplay.svelte';
  import VerseSelector from './VerseSelector.svelte';

  interface Props {
    psalm: PsalmData;
    onBack: () => void;
  }

  let { psalm, onBack }: Props = $props();

  // Local state for this psalm view
  let transposeSemitones = $state(0);
  let activeVerseNumber = $state(1);
  let showLyrics = $state(true);

  // Reset verse number when psalm changes
  $effect(() => {
    activeVerseNumber = psalm.verses.length > 0 ? 1 : 0;
  });

  // Get total number of available verses
  let totalVerses = $derived(psalm.verses.length);

  // Get all verse numbers available
  let allVerseNumbers = $derived.by<number[]>(() => {
    return psalm.verses.map(v => v.number).sort((a, b) => a - b);
  });

  // Detect if the last verse is a half verse (fewer lines than the first verse)
  let hasHalfVerse = $derived.by<boolean>(() => {
    if (psalm.verses.length < 2) return false;
    const firstVerseLines = psalm.verses[0]?.lines?.length ?? 0;
    const lastVerseLines = psalm.verses[psalm.verses.length - 1]?.lines?.length ?? 0;
    // Half verse if last verse has significantly fewer lines (less than 75% of first)
    return lastVerseLines > 0 && lastVerseLines < firstVerseLines * 0.75;
  });

  // Get active verse
  let activeVerse = $derived<VerseLyrics | undefined>(
    psalm.verses.find(v => v.number === activeVerseNumber)
  );

  // Get measures with the correct lyrics applied
  let measures = $derived.by<Measure[]>(() => {
    if (!psalm.melody?.measures) return [];
    
    // If we have an active verse, apply its lyrics/syllables to the melody
    if (activeVerse) {
      const lineCount = activeVerse.lines.length;
      const measuresToUse = psalm.melody.measures.slice(0, lineCount);
      
      return measuresToUse.map((measure, measureIndex) => {
        const newLyrics = activeVerse!.lines[measureIndex] ?? '';
        const syllablesForMeasure = activeVerse!.syllables?.[measureIndex];
        
        // If we have syllables for this measure, apply them to notes
        if (syllablesForMeasure) {
          let syllableIndex = 0;
          const notesWithSyllables = measure.notes.map(note => {
            // Skip rests, they don't get syllables
            if (note.rest) {
              return { ...note, syllable: undefined };
            }
            const syllable = syllablesForMeasure[syllableIndex] ?? '';
            syllableIndex++;
            return { ...note, syllable };
          });
          return {
            ...measure,
            lyrics: newLyrics,
            notes: notesWithSyllables
          };
        }
        
        // No syllables defined, just replace lyrics string
        return {
          ...measure,
          lyrics: newLyrics,
          notes: measure.notes.map(n => ({ ...n, syllable: undefined }))
        };
      });
    }
    
    // Fallback to melody without lyrics
    return psalm.melody.measures;
  });

  function handleTranspose(semitones: number) {
    transposeSemitones = semitones;
  }

  function handleVerseChange(verseNumber: number) {
    activeVerseNumber = verseNumber;
  }

  function handleToggleLyrics(show: boolean) {
    showLyrics = show;
  }

  // Scale state for notation size
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
  let scale = $state(isMobile ? 0.7 : 1.0);
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 2.0;
  const SCALE_STEP = 0.1;

  function increaseScale() {
    scale = Math.min(MAX_SCALE, Math.round((scale + SCALE_STEP) * 10) / 10);
  }

  function decreaseScale() {
    scale = Math.max(MIN_SCALE, Math.round((scale - SCALE_STEP) * 10) / 10);
  }
</script>

<div class="psalm-detail">
  <header class="psalm-header">
    <button class="back-btn" onclick={onBack} aria-label="Back to psalm list">
      ←
    </button>
    <div class="header-center">
      <h1 class="psalm-title">
        Psalm {psalm.number}
        {#if hasHalfVerse}
          <span class="half-verse-indicator" title="Laatste vers is half">½</span>
        {/if}
      </h1>
      <div class="header-controls">
        <div class="transpose-controls">
          <button 
            class="control-btn" 
            onclick={() => transposeSemitones--}
            aria-label="Transpose down one semitone"
          >
            −1
          </button>
          <button 
            class="control-btn original-btn" 
            class:active={transposeSemitones === 0}
            onclick={() => transposeSemitones = 0}
            aria-label="Reset to original key"
          >
            Original
          </button>
          <button 
            class="control-btn" 
            onclick={() => transposeSemitones++}
            aria-label="Transpose up one semitone"
          >
            +1
          </button>
        </div>
        <div class="scale-controls">
          <button 
            class="control-btn" 
            onclick={decreaseScale} 
            disabled={scale <= MIN_SCALE}
            aria-label="Decrease notation size"
          >
            −
          </button>
          <span class="scale-value">{Math.round(scale * 100)}%</span>
          <button 
            class="control-btn" 
            onclick={increaseScale} 
            disabled={scale >= MAX_SCALE}
            aria-label="Increase notation size"
          >
            +
          </button>
        </div>
      </div>
    </div>
  </header>

  <section class="staff-section">
    <StaffDisplay
      {measures}
      keySignature={psalm.keySignature}
      timeSignature={psalm.timeSignature}
      {transposeSemitones}
      {showLyrics}
      {scale}
    />
  </section>

  <section class="verse-section">
    <VerseSelector
      verses={psalm.verses}
      {activeVerseNumber}
      {showLyrics}
      onVerseChange={handleVerseChange}
      onToggleLyrics={handleToggleLyrics}
    />
  </section>
</div>

<style>
  .psalm-detail {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    padding-top: 0;
    max-width: 800px;
    margin: 0 auto;
  }

  .psalm-header {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    margin: -0.5rem -0.5rem 0 -0.5rem;
    background: var(--bg-color);
    border-bottom: 1px solid var(--border-color);
  }

  .back-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-color);
    color: var(--text-color);
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .back-btn:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  .header-center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .psalm-title {
    margin: 0;
    font-size: 1.1rem;
    color: var(--primary-color);
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .half-verse-indicator {
    font-size: 0.75rem;
    color: var(--muted-color);
    opacity: 0.7;
    font-weight: normal;
    cursor: help;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .transpose-controls,
  .scale-controls {
    display: flex;
    align-items: center;
    gap: 0.15rem;
  }

  .control-btn {
    min-width: 24px;
    height: 24px;
    padding: 0 0.3rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-color);
    color: var(--text-color);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .control-btn:hover:not(:disabled) {
    border-color: var(--primary-color);
    color: var(--primary-color);
  }

  .control-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .control-btn.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }

  .original-btn {
    font-size: 0.65rem;
  }

  .scale-value {
    font-size: 0.7rem;
    color: var(--muted-color);
    min-width: 2rem;
    text-align: center;
  }

  .staff-section {
    background: var(--card-bg);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
  }

  /* Mobile optimizations */
  @media (max-width: 640px) {
    .psalm-detail {
      gap: 0.35rem;
      padding: 0.35rem;
      padding-top: 0;
    }

    .psalm-header {
      gap: 0.35rem;
      padding: 0.35rem;
      margin: 0 -0.35rem;
    }

    .back-btn {
      padding: 0.2rem 0.4rem;
      font-size: 0.7rem;
    }

    .psalm-title {
      font-size: 0.9rem;
    }

    .half-verse-indicator {
      font-size: 0.65rem;
    }

    .header-controls {
      gap: 0.3rem;
    }

    .control-btn {
      min-width: 20px;
      height: 20px;
      font-size: 0.65rem;
      padding: 0 0.2rem;
    }

    .original-btn {
      font-size: 0.55rem;
    }

    .scale-value {
      font-size: 0.6rem;
      min-width: 1.6rem;
    }
  }
</style>
