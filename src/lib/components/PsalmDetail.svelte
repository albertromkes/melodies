<script lang="ts">
  import type { PsalmData, Measure, VerseLyrics } from '../types/music';
  import StaffDisplay from './StaffDisplay.svelte';
  import VerseSelector from './VerseSelector.svelte';
  import { hasChordNotations } from '../utils/harmonization';
  import { MIN_TRANSPOSE, MAX_TRANSPOSE } from '../constants/transposition';
  import {
    buildMeasuresForVerse,
    getHeaderTitle,
    getSortedVerseNumbers,
    hasHalfLastVerse,
  } from './psalm-detail.logic';
  import {
    getSwipePreviewText,
    isDoubleTap,
    isTapGesture,
    resolveDoubleTapAction,
    resolveSwipeAction,
    shouldCancelLongPress,
  } from './psalm-gesture.logic';

  interface Props {
    psalm: PsalmData;
    transposeSemitones: number;
    showLyricsByDefault?: boolean;
    showChordsByDefault?: boolean;
    showVerseWatermark?: boolean;
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
    showVerseWatermark = true,
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
  let showLyrics = $state(true);
  let showChords = $state(false);

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
    
    if (isDoubleTap(timeSinceLastTap, distanceFromLastTap, DOUBLE_TAP_DELAY, DOUBLE_TAP_RADIUS)) {
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

    const action = resolveDoubleTapAction({
      x,
      y,
      containerRect: gestureContainerRef.getBoundingClientRect(),
      staffRect: staffSectionRef ? staffSectionRef.getBoundingClientRect() : null,
      hasPreviousSong,
      hasNextSong,
      transposeSemitones,
      minTranspose: MIN_TRANSPOSE,
      maxTranspose: MAX_TRANSPOSE,
      leftZone: LEFT_ZONE,
      rightZone: RIGHT_ZONE,
      topZone: TOP_ZONE,
      bottomZone: BOTTOM_ZONE,
    });

    if (action.type === 'previous-song') {
      if (onPreviousSong) {
        showGestureIndicator('← Vorige');
        onPreviousSong();
      }
      return;
    }

    if (action.type === 'next-song') {
      if (onNextSong) {
        showGestureIndicator('Volgende →');
        onNextSong();
      }
      return;
    }

    if (action.type === 'transpose') {
      const newTranspose = action.value;
      if (onTransposeChange) {
        onTransposeChange(newTranspose);
      }

      if (newTranspose > transposeSemitones) {
        showGestureIndicator(`↑ +${newTranspose}`);
      } else if (newTranspose < transposeSemitones) {
        showGestureIndicator(`↓ ${newTranspose}`);
      } else if (newTranspose === 0) {
        showGestureIndicator('⟲ Origineel');
      }
    }
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

      if (shouldCancelLongPress(deltaX, deltaY, LONG_PRESS_MOVE_TOLERANCE)) {
        longPressCancelled = true;
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }

      const swipePreview = getSwipePreviewText(deltaX, deltaY, allVerseNumbers, activeVerseNumber);
      if (swipePreview) {
        showSwipeTooltip(swipePreview);
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

      const swipeAction = resolveSwipeAction(deltaX, deltaY, deltaTime, MIN_SWIPE_DISTANCE, MAX_SWIPE_TIME);
      if (swipeAction) {
        e.preventDefault();
        if (swipeAction === 'next-verse') {
          goToNextVerse();
        } else {
          goToPreviousVerse();
        }
        return;
      }

      if (isTapGesture(distance, deltaTime)) {
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
    activeVerseNumber = psalm.verses.length > 0 ? getSortedVerseNumbers(psalm.verses)[0] : 0;
  });

  // Get all verse numbers available
  let allVerseNumbers = $derived.by<number[]>(() => {
    return getSortedVerseNumbers(psalm.verses);
  });

  // Detect if the last verse is a half verse (fewer lines than the first verse)
  let hasHalfVerse = $derived.by<boolean>(() => {
    return hasHalfLastVerse(psalm.verses);
  });

  // Check if this psalm has chord notations
  let hasChords = $derived(hasChordNotations(psalm));

  // Get active verse
  let activeVerse = $derived<VerseLyrics | undefined>(
    psalm.verses.find(v => v.number === activeVerseNumber)
  );

  // Get measures with the correct lyrics applied
  let measures = $derived.by<Measure[]>(() => {
    return buildMeasuresForVerse(psalm, activeVerse, transposeSemitones);
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

  let headerTitle = $derived.by(() => {
    return getHeaderTitle(psalm);
  });
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
        {headerTitle}
        {#if hasHalfVerse}
          <span class="half-verse-indicator" title="Laatste vers is half">½</span>
        {/if}
      </h1>
      <div class="header-controls">
        <div class="transpose-controls">
          <button
            class="control-btn"
            onclick={() => handleTranspose(Math.max(transposeSemitones - 1, MIN_TRANSPOSE))}
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
            onclick={() => handleTranspose(Math.min(transposeSemitones + 1, MAX_TRANSPOSE))}
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
    {#if showVerseWatermark}
      <!-- Verse watermark indicator -->
      <div class="verse-watermark" aria-hidden="true">
        <span class="verse-watermark-text">{activeVerseNumber}</span>
      </div>
    {/if}
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

  @media (hover: hover) and (pointer: fine) {
    .control-btn:hover:not(:disabled):not(.active) {
      border-color: var(--primary-color);
      color: var(--primary-color);
    }
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

  .control-btn.active:hover,
  .control-btn.active:focus-visible {
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
    margin-top: 0;
    position: relative;
  }

  .verse-watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 2;
    opacity: 0.1;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: visible;
  }

  .staff-section :global(.staff-display) {
    position: relative;
    z-index: 1;
  }

  .verse-watermark-text {
    font-size: 12rem;
    font-weight: bold;
    color: var(--primary-color);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    line-height: 1;
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .verse-watermark-text {
      font-size: 6rem;
    }
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
