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

  const TRANSPOSE_DOCK_STORAGE_KEY = 'psalm-detail-transpose-dock-position';
  const TRANSPOSE_DOCK_LONG_PRESS_DELAY = 350;
  const TRANSPOSE_DOCK_DOUBLE_TAP_DELAY = 260;
  const TRANSPOSE_DOCK_MOVE_TOLERANCE = 10;
  const TRANSPOSE_DOCK_MARGIN = 12;
  
  // Swipe detection constants
  const MIN_SWIPE_DISTANCE = 80; // minimum pixels to count as swipe
  const MAX_SWIPE_TIME = 500; // maximum ms for swipe gesture

  let transposeDockRef = $state<HTMLElement | null>(null);
  let movableTransposeDock = $state(false);
  let transposeDockPosition = $state<{ x: number; y: number } | null>(null);
  let transposeDockDimensions = $state({ width: 180, height: 56 });
  let transposeDockDragging = $state(false);
  let transposeDockPointerId = $state<number | null>(null);
  let transposeDockPressPoint = $state({ x: 0, y: 0 });
  let transposeDockDragOffset = $state({ x: 0, y: 0 });
  let transposeDockLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  let transposeDockSuppressClick = $state(false);
  let transposeDockTapTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastTransposeDockTapTime = $state(0);

  function getIsMovableTransposeDock(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.innerWidth <= 640 || window.matchMedia('(pointer: coarse)').matches;
  }

  function getSafeInset(variable: '--safe-area-top' | '--safe-area-bottom'): number {
    if (typeof window === 'undefined') {
      return 0;
    }

    const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getTransposeDockBounds() {
    if (typeof window === 'undefined') {
      return {
        minLeft: TRANSPOSE_DOCK_MARGIN,
        maxLeft: TRANSPOSE_DOCK_MARGIN,
        minTop: TRANSPOSE_DOCK_MARGIN,
        maxTop: TRANSPOSE_DOCK_MARGIN,
      };
    }

    const width = transposeDockDimensions.width;
    const height = transposeDockDimensions.height;
    const minLeft = TRANSPOSE_DOCK_MARGIN;
    const maxLeft = Math.max(minLeft, window.innerWidth - width - TRANSPOSE_DOCK_MARGIN);
    const minTop = getSafeInset('--safe-area-top') + TRANSPOSE_DOCK_MARGIN;
    const maxTop = Math.max(
      minTop,
      window.innerHeight - height - getSafeInset('--safe-area-bottom') - TRANSPOSE_DOCK_MARGIN
    );

    return { minLeft, maxLeft, minTop, maxTop };
  }

  function clampTransposeDockPixelPosition(left: number, top: number) {
    const bounds = getTransposeDockBounds();

    return {
      left: Math.min(Math.max(left, bounds.minLeft), bounds.maxLeft),
      top: Math.min(Math.max(top, bounds.minTop), bounds.maxTop),
    };
  }

  function normalizeTransposeDockPosition(left: number, top: number) {
    const bounds = getTransposeDockBounds();
    const xRange = Math.max(1, bounds.maxLeft - bounds.minLeft);
    const yRange = Math.max(1, bounds.maxTop - bounds.minTop);
    const clamped = clampTransposeDockPixelPosition(left, top);

    return {
      x: (clamped.left - bounds.minLeft) / xRange,
      y: (clamped.top - bounds.minTop) / yRange,
    };
  }

  function denormalizeTransposeDockPosition(position: { x: number; y: number }) {
    const bounds = getTransposeDockBounds();

    return clampTransposeDockPixelPosition(
      bounds.minLeft + position.x * Math.max(1, bounds.maxLeft - bounds.minLeft),
      bounds.minTop + position.y * Math.max(1, bounds.maxTop - bounds.minTop)
    );
  }

  function saveTransposeDockPosition(position: { x: number; y: number } | null) {
    if (typeof window === 'undefined') {
      return;
    }

    if (!position) {
      window.localStorage.removeItem(TRANSPOSE_DOCK_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(TRANSPOSE_DOCK_STORAGE_KEY, JSON.stringify(position));
  }

  function resetTransposeDockPosition(showHint = true) {
    transposeDockPosition = null;
    saveTransposeDockPosition(null);

    if (showHint && movableTransposeDock) {
      showGestureIndicator('Regelaar teruggezet');
    }
  }

  function isOverlayInteractionTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest('.transpose-dock, .scale-popover, .psalm-header') !== null;
  }
  
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

  function clearTransposeDockLongPressTimer() {
    if (transposeDockLongPressTimer) {
      clearTimeout(transposeDockLongPressTimer);
      transposeDockLongPressTimer = null;
    }
  }

  function updateTransposeDockMeasurements() {
    if (!transposeDockRef) {
      return;
    }

    const rect = transposeDockRef.getBoundingClientRect();
    transposeDockDimensions = {
      width: rect.width,
      height: rect.height,
    };
  }

  function updateTransposeDockPositionFromPointer(clientX: number, clientY: number) {
    const clamped = clampTransposeDockPixelPosition(
      clientX - transposeDockDragOffset.x,
      clientY - transposeDockDragOffset.y
    );

    transposeDockPosition = normalizeTransposeDockPosition(clamped.left, clamped.top);
  }

  function handleTransposeDockPointerMove(event: PointerEvent) {
    if (event.pointerId !== transposeDockPointerId) {
      return;
    }

    const movedX = event.clientX - transposeDockPressPoint.x;
    const movedY = event.clientY - transposeDockPressPoint.y;

    if (!transposeDockDragging) {
      if (shouldCancelLongPress(movedX, movedY, TRANSPOSE_DOCK_MOVE_TOLERANCE)) {
        clearTransposeDockLongPressTimer();
        transposeDockPointerId = null;
      }
      return;
    }

    event.preventDefault();
    updateTransposeDockPositionFromPointer(event.clientX, event.clientY);
  }

  function finishTransposeDockDrag(pointerId: number) {
    if (pointerId !== transposeDockPointerId) {
      return;
    }

    clearTransposeDockLongPressTimer();

    if (transposeDockDragging && transposeDockPosition) {
      saveTransposeDockPosition(transposeDockPosition);
      showGestureIndicator('Regelaar verplaatst');
    }

    transposeDockDragging = false;
    transposeDockPointerId = null;
  }

  function handleTransposeDockPointerUp(event: PointerEvent) {
    finishTransposeDockDrag(event.pointerId);
  }

  function handleTransposeDockPointerCancel(event: PointerEvent) {
    finishTransposeDockDrag(event.pointerId);
  }

  function handleTransposeDockHandlePointerDown(event: PointerEvent) {
    if (!movableTransposeDock || !transposeDockRef) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    updateTransposeDockMeasurements();

    const rect = transposeDockRef.getBoundingClientRect();
    transposeDockPressPoint = { x: event.clientX, y: event.clientY };
    transposeDockDragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    transposeDockPointerId = event.pointerId;
    transposeDockSuppressClick = false;

    clearTransposeDockLongPressTimer();
    transposeDockLongPressTimer = setTimeout(() => {
      if (transposeDockPointerId !== event.pointerId) {
        return;
      }

      transposeDockDragging = true;
      transposeDockSuppressClick = true;
      transposeDockRef?.setPointerCapture(event.pointerId);
      showGestureIndicator('Sleep regelaar');
      updateTransposeDockPositionFromPointer(event.clientX, event.clientY);
    }, TRANSPOSE_DOCK_LONG_PRESS_DELAY);
  }

  function handleTransposeDockHandlePointerMove(event: PointerEvent) {
    if (!movableTransposeDock) {
      return;
    }

    handleTransposeDockPointerMove(event);
  }

  function handleTransposeDockHandlePointerUp(event: PointerEvent) {
    clearTransposeDockLongPressTimer();

    if (transposeDockDragging) {
      handleTransposeDockPointerUp(event);
      return;
    }

    if (event.pointerId === transposeDockPointerId) {
      transposeDockPointerId = null;
    }

    if (!movableTransposeDock) {
      return;
    }

    const now = Date.now();
    if (now - lastTransposeDockTapTime <= TRANSPOSE_DOCK_DOUBLE_TAP_DELAY) {
      if (transposeDockTapTimeout) {
        clearTimeout(transposeDockTapTimeout);
        transposeDockTapTimeout = null;
      }

      lastTransposeDockTapTime = 0;
      resetTransposeDockPosition();
      transposeDockSuppressClick = true;
      return;
    }

    lastTransposeDockTapTime = now;
    if (transposeDockTapTimeout) {
      clearTimeout(transposeDockTapTimeout);
    }
    transposeDockTapTimeout = setTimeout(() => {
      lastTransposeDockTapTime = 0;
      transposeDockTapTimeout = null;
    }, TRANSPOSE_DOCK_DOUBLE_TAP_DELAY);
  }

  function handleTransposeDockHandlePointerCancel(event: PointerEvent) {
    clearTransposeDockLongPressTimer();

    if (transposeDockDragging) {
      handleTransposeDockPointerCancel(event);
    } else if (event.pointerId === transposeDockPointerId) {
      transposeDockPointerId = null;
    }
  }

  function handleTransposeDockContainerPointerMove(event: PointerEvent) {
    if (!movableTransposeDock) {
      return;
    }

    handleTransposeDockPointerMove(event);
  }

  function handleTransposeDockContainerPointerUp(event: PointerEvent) {
    if (!movableTransposeDock || !transposeDockDragging) {
      return;
    }

    handleTransposeDockPointerUp(event);
  }

  function handleTransposeDockContainerPointerCancel(event: PointerEvent) {
    if (!movableTransposeDock || !transposeDockDragging) {
      return;
    }

    handleTransposeDockPointerCancel(event);
  }

  function handleTransposeDockButtonClick(event: MouseEvent, semitones: number) {
    handleTranspose(semitones);
  }

  function handleTransposeDockResetClick(event: MouseEvent) {
    if (transposeDockSuppressClick) {
      event.preventDefault();
      transposeDockSuppressClick = false;
      return;
    }

    handleTranspose(0);
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
      if (isOverlayInteractionTarget(e.target)) {
        return;
      }

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
      if (isOverlayInteractionTarget(e.target)) {
        return;
      }

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
      if (isOverlayInteractionTarget(e.target)) {
        return;
      }

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

  let showScaleMenu = $state(false);

  function toggleScaleMenu() {
    showScaleMenu = !showScaleMenu;
  }

  let headerTitle = $derived.by(() => {
    return getHeaderTitle(psalm);
  });

  let transposeLabel = $derived.by(() => {
    if (transposeSemitones === 0) {
      return 'Orig.';
    }

    return transposeSemitones > 0 ? `+${transposeSemitones}` : `${transposeSemitones}`;
  });

  let transposeDockStyle = $derived.by(() => {
    if (!movableTransposeDock || !transposeDockPosition) {
      return undefined;
    }

    const position = denormalizeTransposeDockPosition(transposeDockPosition);
    return `left: ${position.left}px; top: ${position.top}px; right: auto; bottom: auto; transform: none;`;
  });

  $effect(() => {
    movableTransposeDock = getIsMovableTransposeDock();

    if (typeof window === 'undefined') {
      return;
    }

    if (!movableTransposeDock) {
      transposeDockPosition = null;
      return;
    }

    const savedPosition = window.localStorage.getItem(TRANSPOSE_DOCK_STORAGE_KEY);
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition) as { x?: number; y?: number };
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          transposeDockPosition = {
            x: Math.min(Math.max(parsed.x, 0), 1),
            y: Math.min(Math.max(parsed.y, 0), 1),
          };
        }
      } catch {
        transposeDockPosition = null;
      }
    }

    updateTransposeDockMeasurements();

    const handleResize = () => {
      movableTransposeDock = getIsMovableTransposeDock();
      updateTransposeDockMeasurements();
      if (!movableTransposeDock || !transposeDockPosition) {
        return;
      }

      transposeDockPosition = normalizeTransposeDockPosition(
        denormalizeTransposeDockPosition(transposeDockPosition).left,
        denormalizeTransposeDockPosition(transposeDockPosition).top
      );
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTransposeDockLongPressTimer();
      if (transposeDockTapTimeout) {
        clearTimeout(transposeDockTapTimeout);
        transposeDockTapTimeout = null;
      }
    };
  });

  $effect(() => {
    transposeDockRef;
    updateTransposeDockMeasurements();
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
    <h1 class="psalm-title">
      {headerTitle}
      {#if hasHalfVerse}
        <span class="half-verse-indicator" title="Laatste vers is half">½</span>
      {/if}
    </h1>
    <button
      class="control-btn zoom-toggle"
      class:active={showScaleMenu}
      onclick={toggleScaleMenu}
      aria-label="Zoomopties"
      aria-expanded={showScaleMenu}
    >
      {Math.round(scale * 100)}%
    </button>

    {#if showScaleMenu}
      <div class="scale-popover" role="group" aria-label="Zoom bedienen">
        <button
          class="control-btn scale-step-btn"
          onclick={decreaseScale}
          disabled={scale <= MIN_SCALE}
          aria-label="Verkleinen"
        >
          −
        </button>
        <span class="scale-value">{Math.round(scale * 100)}%</span>
        <button
          class="control-btn scale-step-btn"
          onclick={increaseScale}
          disabled={scale >= MAX_SCALE}
          aria-label="Vergroten"
        >
          +
        </button>
      </div>
    {/if}
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

  <div
    class="transpose-dock"
    class:movable={movableTransposeDock}
    class:dragging={transposeDockDragging}
    style={transposeDockStyle}
    bind:this={transposeDockRef}
    onpointermove={handleTransposeDockContainerPointerMove}
    onpointerup={handleTransposeDockContainerPointerUp}
    onpointercancel={handleTransposeDockContainerPointerCancel}
    role="group"
    aria-label="Transponeren"
  >
    <button
      class="control-btn transpose-dock-btn"
      onclick={(event) => handleTransposeDockButtonClick(event, Math.max(transposeSemitones - 1, MIN_TRANSPOSE))}
      aria-label="Halve toon omlaag"
    >
      −1
    </button>
    <button
      class="control-btn transpose-status"
      class:active={transposeSemitones === 0}
      class:shifted={transposeSemitones !== 0}
      onclick={handleTransposeDockResetClick}
      onpointerdown={handleTransposeDockHandlePointerDown}
      onpointermove={handleTransposeDockHandlePointerMove}
      onpointerup={handleTransposeDockHandlePointerUp}
      onpointercancel={handleTransposeDockHandlePointerCancel}
      aria-label="Terug naar originele toonhoogte"
    >
      {transposeLabel}
    </button>
    <button
      class="control-btn transpose-dock-btn"
      onclick={(event) => handleTransposeDockButtonClick(event, Math.min(transposeSemitones + 1, MAX_TRANSPOSE))}
      aria-label="Halve toon omhoog"
    >
      +1
    </button>
  </div>

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
    padding: 0 0.5rem calc(5.75rem + var(--detail-safe-bottom));
    padding-top: 0;
    max-width: 800px;
    margin: 0 auto;
    position: relative;
    touch-action: manipulation; /* Enables tap/swipe but disables double-tap zoom */
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    min-height: 100vh; /* Ensure full height for gesture detection */
    min-height: 100dvh;
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
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    padding: calc(var(--detail-safe-top) + 0.1rem) 0.75rem 0.45rem;
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

  .psalm-title {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 1.15rem;
    color: var(--primary-color);
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-weight: bold;
    line-height: 1.15;
  }

  .half-verse-indicator {
    font-size: 0.85rem;
    color: var(--muted-color);
    opacity: 0.7;
    font-weight: normal;
    cursor: help;
  }

  .control-btn {
    min-width: 40px;
    height: 40px;
    padding: 0 0.5rem;
    font-size: 0.95rem;
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

  .zoom-toggle {
    min-width: 54px;
    font-size: 0.78rem;
    justify-self: end;
  }

  .scale-popover {
    position: absolute;
    top: calc(100% - 0.15rem);
    right: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem;
    border: 1px solid var(--border-color);
    border-radius: 14px;
    background: color-mix(in srgb, var(--bg-color) 92%, white 8%);
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
    backdrop-filter: blur(10px);
  }

  .scale-step-btn {
    min-width: 34px;
    height: 34px;
  }

  .scale-value {
    font-size: 0.85rem;
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

  .transpose-dock {
    position: fixed;
    left: 50%;
    bottom: calc(0.85rem + var(--detail-safe-bottom));
    transform: translateX(-50%);
    z-index: 120;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem;
    border: 1px solid color-mix(in srgb, var(--border-color) 85%, transparent 15%);
    border-radius: 18px;
    background: color-mix(in srgb, var(--bg-color) 88%, white 12%);
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16);
    backdrop-filter: blur(14px);
    touch-action: none;
    transition: box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
  }

  .transpose-dock.movable {
    cursor: grab;
  }

  .transpose-dock.dragging {
    cursor: grabbing;
    box-shadow: 0 20px 48px rgba(15, 23, 42, 0.22);
    opacity: 0.96;
  }

  .transpose-dock-btn {
    min-width: 56px;
    height: 48px;
    font-size: 1rem;
  }

  .transpose-status {
    min-width: 72px;
    height: 48px;
    padding: 0 0.85rem;
    font-size: 0.9rem;
    font-weight: 700;
    position: relative;
  }

  .transpose-dock.movable .transpose-status::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: 0.35rem;
    transform: translateX(-50%);
    width: 20px;
    height: 3px;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 22%, transparent 78%);
  }

  .transpose-status.shifted {
    background: color-mix(in srgb, var(--primary-color) 14%, var(--bg-color) 86%);
    border-color: color-mix(in srgb, var(--primary-color) 55%, var(--border-color) 45%);
    color: var(--primary-color);
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
      padding: 0 0.35rem calc(5.25rem + var(--detail-safe-bottom));
      padding-top: 0;
    }

    .psalm-header {
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 0.5rem;
      padding: calc(var(--detail-safe-top) + 0.05rem) 0.5rem 0.35rem;
      margin: 0 -0.35rem;
    }

    .back-btn {
      padding: 0.4rem 0.6rem;
      font-size: 1.1rem;
      min-width: 44px;
      min-height: 44px;
    }

    .psalm-title {
      font-size: 1rem;
    }

    .half-verse-indicator {
      font-size: 0.75rem;
    }

    .zoom-toggle {
      min-width: 50px;
      height: 36px;
      font-size: 0.72rem;
    }

    .control-btn {
      min-width: 36px;
      height: 36px;
      font-size: 0.85rem;
      padding: 0 0.35rem;
    }

    .scale-value {
      font-size: 0.75rem;
      min-width: 2.2rem;
    }

    .scale-popover {
      right: 0.35rem;
      padding: 0.3rem;
    }

    .transpose-dock {
      gap: 0.3rem;
      padding: 0.35rem;
      border-radius: 16px;
    }

    .transpose-dock-btn {
      min-width: 52px;
      height: 44px;
      font-size: 0.95rem;
    }

    .transpose-status {
      min-width: 68px;
      height: 44px;
      font-size: 0.84rem;
    }
  }

  @media (min-width: 641px) {
    .psalm-detail {
      padding-bottom: 1rem;
    }

    .transpose-dock {
      left: auto;
      right: max(1rem, calc(50vw - 390px));
      bottom: 1rem;
      transform: none;
    }
  }
</style>
