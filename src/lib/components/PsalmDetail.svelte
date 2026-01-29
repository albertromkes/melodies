<script lang="ts">
  import type { PsalmData, Measure, VerseLyrics } from '../types/music';
  import StaffDisplay from './StaffDisplay.svelte';
  import VerseSelector from './VerseSelector.svelte';
  import { transposeChordsInMeasure, hasChordNotations } from '../utils/harmonization';

  interface Props {
    psalm: PsalmData;
    transposeSemitones: number;
    showLyricsByDefault?: boolean;
    showChordsByDefault?: boolean;
    onTransposeChange?: (value: number) => void;
    onBack: () => void;
    onNextSong?: () => void;
    onPreviousSong?: () => void;
    hasNextSong?: boolean;
    hasPreviousSong?: boolean;
    onToggleTheme?: () => void;
  }

  let { 
    psalm, 
    transposeSemitones, 
    showLyricsByDefault = true,
    showChordsByDefault = false,
    onTransposeChange, 
    onBack, 
    onNextSong, 
    onPreviousSong, 
    hasNextSong = false, 
    hasPreviousSong = false, 
    onToggleTheme 
  }: Props = $props();

  // Local state for this psalm view
  let activeVerseNumber = $state(1);
  let showLyrics = $state(showLyricsByDefault);
  let showChords = $state(showChordsByDefault);

  // Initialize state when props change
  $effect(() => {
    showLyrics = showLyricsByDefault;
    showChords = showChordsByDefault;
  });
  
  // Touch gesture state
  let touchStartX = $state(0);
  let touchStartY = $state(0);
  let touchStartTime = $state(0);
  let lastTapTime = $state(0);
  let lastTapX = $state(0);
  let lastTapY = $state(0);
  let gestureContainerRef = $state<HTMLElement | null>(null);
  let staffSectionRef = $state<HTMLElement | null>(null);
  
  // Gesture feedback state
  let gestureIndicator = $state<string | null>(null);
  let gestureIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;

  // Long press state
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressCancelled = $state(false);
  
  function showGestureIndicator(text: string) {
    gestureIndicator = text;
    if (gestureIndicatorTimeout) {
      clearTimeout(gestureIndicatorTimeout);
    }
    gestureIndicatorTimeout = setTimeout(() => {
      gestureIndicator = null;
    }, 800);
  }
  
  // Double-tap detection constants
  const DOUBLE_TAP_DELAY = 300; // ms between taps
  const DOUBLE_TAP_RADIUS = 50; // pixels - taps must be close together
  
  // Screen zone boundaries (percentages)
  const LEFT_ZONE = 0.3; // Left 30% of screen
  const RIGHT_ZONE = 0.7; // Right 30% starts at 70%
  const TOP_ZONE = 0.25; // Top 25%
  const BOTTOM_ZONE = 0.75; // Bottom 25% starts at 75%

  // Long press detection constants
  const LONG_PRESS_DELAY = 1000; // ms to trigger long press
  const LONG_PRESS_MOVE_TOLERANCE = 12; // pixels before canceling long press
  
  // Swipe detection constants
  const MIN_SWIPE_DISTANCE = 80; // minimum pixels to count as swipe
  const MAX_SWIPE_TIME = 500; // maximum ms for swipe gesture
  
  function handleTap(x: number, y: number) {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime;
    const distanceFromLastTap = Math.sqrt(
      Math.pow(x - lastTapX, 2) + Math.pow(y - lastTapY, 2)
    );
    
    // Check for double tap
    if (timeSinceLastTap < DOUBLE_TAP_DELAY && distanceFromLastTap < DOUBLE_TAP_RADIUS) {
      handleDoubleTap(x, y);
      lastTapTime = 0; // Reset to prevent triple-tap
    } else {
      lastTapTime = now;
      lastTapX = x;
      lastTapY = y;
    }
  }
  
  function handleDoubleTap(x: number, y: number) {
    if (!gestureContainerRef) return;
    
    const rect = gestureContainerRef.getBoundingClientRect();
    const relativeX = (x - rect.left) / rect.width;
    
    // Determine which zone was double-tapped
    // Priority: left/right for song navigation (works anywhere)
    
    // Left zone: previous song
    if (relativeX < LEFT_ZONE) {
      if (hasPreviousSong && onPreviousSong) {
        showGestureIndicator('← Vorige');
        onPreviousSong();
      }
      return;
    }
    
    // Right zone: next song
    if (relativeX > RIGHT_ZONE) {
      if (hasNextSong && onNextSong) {
        showGestureIndicator('Volgende →');
        onNextSong();
      }
      return;
    }
    
    // Transpose gestures only work within the staff section
    if (!staffSectionRef) return;
    
    const staffRect = staffSectionRef.getBoundingClientRect();
    const isWithinStaff = (
      x >= staffRect.left &&
      x <= staffRect.right &&
      y >= staffRect.top &&
      y <= staffRect.bottom
    );
    
    if (!isWithinStaff) return;
    
    // Calculate relative Y position within the staff section
    const relativeYInStaff = (y - staffRect.top) / staffRect.height;
    
    // Top zone of staff: transpose up
    if (relativeYInStaff < TOP_ZONE) {
      const newTranspose = Math.min(transposeSemitones + 1, 3);
      if (onTransposeChange) {
        onTransposeChange(newTranspose);
      }
      showGestureIndicator(`↑ +${newTranspose}`);
      return;
    }

    // Bottom zone of staff: transpose down
    if (relativeYInStaff > BOTTOM_ZONE) {
      const newTranspose = Math.max(transposeSemitones - 1, -3);
      if (onTransposeChange) {
        onTransposeChange(newTranspose);
      }
      showGestureIndicator(`↓ ${newTranspose}`);
      return;
    }

    // Center zone of staff: reset transposition
    if (transposeSemitones !== 0) {
      if (onTransposeChange) {
        onTransposeChange(0);
      }
      showGestureIndicator('⟲ Origineel');
    }
  }

  function handleTouchStart(e: TouchEvent) {
    if (!gestureContainerRef) return;

    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();

    // Start long press timer for theme toggle
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      if (onToggleTheme) {
        showGestureIndicator('🌙 Thema gewijzigd');
        onToggleTheme();
      }
    }, LONG_PRESS_DELAY);
  }

  function handleTouchEnd(e: TouchEvent) {
    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;

    // If it was a long press, don't handle other gestures
    if (touchDuration >= LONG_PRESS_DELAY) {
      return;
    }

    // Handle tap/double tap for existing gestures
    const touch = e.changedTouches[0];
    handleTap(touch.clientX, touch.clientY);
  }

  function goToNextVerse() {
    const currentIndex = allVerseNumbers.indexOf(activeVerseNumber);
    if (currentIndex < allVerseNumbers.length - 1) {
      activeVerseNumber = allVerseNumbers[currentIndex + 1];
      showGestureIndicator(`Vers ${activeVerseNumber}`);
    }
  }
  
  function goToPreviousVerse() {
    const currentIndex = allVerseNumbers.indexOf(activeVerseNumber);
    if (currentIndex > 0) {
      activeVerseNumber = allVerseNumbers[currentIndex - 1];
      showGestureIndicator(`Vers ${activeVerseNumber}`);
    }
  }

  // Swipe tooltip state
  let swipeTooltip = $state<string | null>(null);
  let swipeTooltipTimeout: ReturnType<typeof setTimeout> | null = null;

  function showSwipeTooltip(text: string) {
    swipeTooltip = text;
    if (swipeTooltipTimeout) {
      clearTimeout(swipeTooltipTimeout);
    }
    swipeTooltipTimeout = setTimeout(() => {
      swipeTooltip = null;
    }, 1000);
  }

  // Attach touch event listeners using $effect for proper Android WebView support
  $effect(() => {
    const container = gestureContainerRef;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      longPressCancelled = false;

      // Start long press timer for theme toggle
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (!longPressCancelled && onToggleTheme) {
          showGestureIndicator('🌙 Thema gewijzigd');
          onToggleTheme();
        }
      }, LONG_PRESS_DELAY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !touchStartTime) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > LONG_PRESS_MOVE_TOLERANCE) {
        longPressCancelled = true;
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }

      // Show swipe tooltip for verse navigation
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        const currentIndex = allVerseNumbers.indexOf(activeVerseNumber);
        if (deltaX < 0 && currentIndex < allVerseNumbers.length - 1) {
          // Swipe left - show next verse
          showSwipeTooltip(`→ Vers ${allVerseNumbers[currentIndex + 1]}`);
        } else if (deltaX > 0 && currentIndex > 0) {
          // Swipe right - show previous verse
          showSwipeTooltip(`← Vers ${allVerseNumbers[currentIndex - 1]}`);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      // Clear swipe tooltip
      if (swipeTooltipTimeout) {
        clearTimeout(swipeTooltipTimeout);
        swipeTooltipTimeout = null;
      }
      swipeTooltip = null;

      // Clear long press timer
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      if (e.changedTouches.length !== 1) return;

      const touch = e.changedTouches[0];
      const endX = touch.clientX;
      const endY = touch.clientY;
      const endTime = Date.now();

      const deltaX = endX - touchStartX;
      const deltaY = endY - touchStartY;
      const deltaTime = endTime - touchStartTime;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Check for swipe gesture (horizontal swipe for verse navigation)
      if (deltaTime < MAX_SWIPE_TIME && Math.abs(deltaX) > MIN_SWIPE_DISTANCE && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        e.preventDefault();
        // Horizontal swipe detected
        if (deltaX < 0) {
          // Swipe left (from right to middle) → next verse
          goToNextVerse();
        } else {
          // Swipe right (from left to middle) → previous verse
          goToPreviousVerse();
        }
        return;
      }

      // Check for tap (minimal movement)
      if (distance < 20 && deltaTime < 300) {
        handleTap(endX, endY);
      }
    };

    // Add event listeners
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: false });

    // Cleanup
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  });

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

  // Check if this psalm has chord notations
  let hasChords = $derived(hasChordNotations(psalm));

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
        
        // Transpose chords if present
        const transposedChords = transposeChordsInMeasure(measure.chords, transposeSemitones);
        
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
            notes: notesWithSyllables,
            chords: transposedChords
          };
        }
        
        // No syllables defined, just replace lyrics string
        return {
          ...measure,
          lyrics: newLyrics,
          notes: measure.notes.map(n => ({ ...n, syllable: undefined })),
          chords: transposedChords
        };
      });
    }
    
    // Fallback to melody without lyrics (but still transpose chords)
    return psalm.melody.measures.map(measure => ({
      ...measure,
      chords: transposeChordsInMeasure(measure.chords, transposeSemitones)
    }));
  });

  function handleTranspose(semitones: number) {
    if (onTransposeChange) {
      onTransposeChange(semitones);
    }
  }

  function handleVerseChange(verseNumber: number) {
    activeVerseNumber = verseNumber;
  }

  function handleToggleLyrics(show: boolean) {
    showLyrics = show;
  }

  function handleToggleChords(show: boolean) {
    showChords = show;
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

<div 
  class="psalm-detail"
  bind:this={gestureContainerRef}
>
  <!-- Gesture indicator overlay -->
  {#if gestureIndicator}
    <div class="gesture-indicator">
      {gestureIndicator}
    </div>
  {/if}

  <!-- Swipe tooltip overlay -->
  {#if swipeTooltip}
    <div class="swipe-tooltip">
      {swipeTooltip}
    </div>
  {/if}
  
  <header class="psalm-header">
    <button class="back-btn" onclick={onBack} aria-label="Terug naar lijst">
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
            onclick={() => handleTranspose(Math.max(transposeSemitones - 1, -3))}
            aria-label="Halve toon omlaag"
          >
            −1
          </button>
          <button
            class="control-btn original-btn"
            class:active={transposeSemitones === 0}
            onclick={() => handleTranspose(0)}
            aria-label="Originele toonhoogte"
          >
            Origineel
          </button>
          <button
            class="control-btn"
            onclick={() => handleTranspose(Math.min(transposeSemitones + 1, 3))}
            aria-label="Halve toon omhoog"
          >
            +1
          </button>
        </div>
        <div class="scale-controls">
          <button 
            class="control-btn" 
            onclick={decreaseScale} 
            disabled={scale <= MIN_SCALE}
            aria-label="Verkleinen"
          >
            −
          </button>
          <span class="scale-value">{Math.round(scale * 100)}%</span>
          <button 
            class="control-btn" 
            onclick={increaseScale} 
            disabled={scale >= MAX_SCALE}
            aria-label="Vergroten"
          >
            +
          </button>
        </div>
      </div>
    </div>
  </header>

  <section class="staff-section" bind:this={staffSectionRef}>
    <StaffDisplay
      {measures}
      keySignature={psalm.keySignature}
      timeSignature={psalm.timeSignature}
      {transposeSemitones}
      {showLyrics}
      {showChords}
      {scale}
    />
  </section>

  <section class="verse-section">
    <VerseSelector
      verses={psalm.verses}
      {activeVerseNumber}
      {showLyrics}
      {showChords}
      {hasChords}
      onVerseChange={handleVerseChange}
      onToggleLyrics={handleToggleLyrics}
      onToggleChords={handleToggleChords}
    />
  </section>
</div>

<style>
  .psalm-detail {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    padding-top: 0;
    max-width: 800px;
    margin: 0 auto;
    position: relative;
    touch-action: manipulation; /* Enables tap/swipe but disables double-tap zoom */
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    min-height: 100vh; /* Ensure full height for gesture detection */
  }

  .gesture-indicator {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-size: 1.5rem;
    font-weight: bold;
    z-index: 1000;
    pointer-events: none;
    animation: fadeInOut 0.8s ease-out forwards;
  }

  .swipe-tooltip {
    position: fixed;
    top: 60%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--primary-color);
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 1.2rem;
    font-weight: bold;
    z-index: 1000;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: tooltipFadeIn 0.2s ease-out;
  }

  @keyframes fadeInOut {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8);
    }
    15% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @keyframes tooltipFadeIn {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) translateY(10px);
    }
    100% {
      opacity: 1;
      transform: translate(-50%, -50%) translateY(0);
    }
  }

  .psalm-header {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    margin: 0 -0.5rem;
    background: var(--bg-color);
    border-bottom: 1px solid var(--border-color);
  }

  .back-btn {
    padding: 0.5rem 0.75rem;
    font-size: 1.25rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-color);
    color: var(--text-color);
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
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
    font-size: 1.25rem;
    color: var(--primary-color);
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-weight: bold;
  }

  .half-verse-indicator {
    font-size: 0.85rem;
    color: var(--muted-color);
    opacity: 0.7;
    font-weight: normal;
    cursor: help;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .transpose-controls,
  .scale-controls {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .control-btn {
    min-width: 44px;
    height: 44px;
    padding: 0 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    border: 1px solid var(--border-color);
    border-radius: 6px;
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
    font-size: 0.85rem;
  }

  .scale-value {
    font-size: 0.9rem;
    color: var(--muted-color);
    min-width: 3rem;
    text-align: center;
  }

  .staff-section {
    background: var(--card-bg);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    margin-top: 0;
  }

  /* Mobile optimizations */
  @media (max-width: 640px) {
    .psalm-detail {
      gap: 0.2rem;
      padding: 0.35rem;
      padding-top: 0;
    }

    .psalm-header {
      gap: 0.5rem;
      padding: 0.5rem;
      margin: 0 -0.35rem;
    }

    .back-btn {
      padding: 0.4rem 0.6rem;
      font-size: 1.1rem;
      min-width: 44px;
      min-height: 44px;
    }

    .psalm-title {
      font-size: 1.1rem;
    }

    .half-verse-indicator {
      font-size: 0.75rem;
    }

    .header-controls {
      gap: 0.5rem;
    }

    .control-btn {
      min-width: 40px;
      height: 40px;
      font-size: 0.9rem;
      padding: 0 0.4rem;
    }

    .original-btn {
      font-size: 0.7rem;
      min-width: 50px;
    }

    .scale-value {
      font-size: 0.8rem;
      min-width: 2.5rem;
    }
  }
</style>
