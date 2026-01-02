<script lang="ts">
  import type { PsalmData, Measure, VerseLyrics } from '../types/music';
  import StaffDisplay from './StaffDisplay.svelte';
  import TransposeControls from './TransposeControls.svelte';
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
</script>

<div class="psalm-detail">
  <header class="psalm-header">
    <button class="back-btn" onclick={onBack} aria-label="Back to psalm list">
      ← Back
    </button>
    <div class="psalm-title-section">
      <h1>Psalm {psalm.number}</h1>
    </div>
  </header>

  <section class="staff-section">
    <StaffDisplay
      {measures}
      keySignature={psalm.keySignature}
      timeSignature={psalm.timeSignature}
      {transposeSemitones}
      {showLyrics}
    />
  </section>

  <section class="controls-section">
    <TransposeControls
      currentSemitones={transposeSemitones}
      onTranspose={handleTranspose}
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
    gap: 1rem;
    padding: 1rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .psalm-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .back-btn {
    padding: 0.5rem 1rem;
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

  .psalm-title-section {
    flex: 1;
  }

  .psalm-title-section h1 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--primary-color);
  }

  .staff-section {
    background: var(--card-bg);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
  }
</style>
