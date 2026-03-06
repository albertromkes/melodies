<script lang="ts">
  import { onMount } from 'svelte';
  import type { Measure } from '../types/music';
  import { transposeNotesWithKey, getTransposedKey } from '../utils/transposition';
  import { renderMultiLineMelody, calculateMultiLineDimensions, type RenderConfig } from '../utils/vexflow-renderer';

  interface Props {
    measures: Measure[];
    keySignature: string;
    timeSignature: [number, number];
    transposeSemitones: number;
    showLyrics: boolean;
    showChords: boolean;
    scale: number;
  }

  let { measures, keySignature, timeSignature, transposeSemitones, showLyrics, showChords, scale }: Props = $props();

  let containerRef: HTMLDivElement | null = $state(null);
  let containerWidth = $state(600);
  let renderFrameId: number | null = null;
  let fontRenderFrameId: number | null = null;
  let renderGeneration = 0;

  const CHORD_FONT_SIZE = 13;
  const CHORD_VERTICAL_OFFSET = 30;
  const CHORD_MIN_GAP = 8;

  // Compute transposed key first (needed for note transposition with accidentals)
  let displayKey = $derived(getTransposedKey(keySignature, transposeSemitones));
  
  // Compute transposed measures with key-aware accidental handling
  let transposedMeasures = $derived(
    measures.map(m => ({
      ...m,
      notes: transposeNotesWithKey(m.notes, transposeSemitones, keySignature, displayKey),
    }))
  );

  function clearScheduledRenders() {
    if (renderFrameId !== null) {
      cancelAnimationFrame(renderFrameId);
      renderFrameId = null;
    }
    if (fontRenderFrameId !== null) {
      cancelAnimationFrame(fontRenderFrameId);
      fontRenderFrameId = null;
    }
  }

  function renderWholeLineLyrics(
    svg: SVGSVGElement,
    vexflowGroup: SVGGElement | SVGSVGElement,
    staves: NodeListOf<Element>,
    measure: Measure,
    index: number,
    lyricsFontSize: number
  ) {
    if (!measure.lyrics) return;

    const stave = staves[index];
    if (!stave) return;

    const stavePath = stave.querySelector('path');
    const staveYPos = stavePath ? parseFloat(stavePath.getAttribute('d')?.split(' ')[1] || '0') : 0;
    const lyricsY = staveYPos + 70;

    const allNotes = svg.querySelectorAll('.vf-stavenote');
    const staveNotes: {x: number, isRest: boolean}[] = [];

    allNotes.forEach((note) => {
      const rect = note.querySelector('rect');
      if (rect) {
        const noteY = parseFloat(rect.getAttribute('y') || '0');
        const noteHeight = parseFloat(rect.getAttribute('height') || '0');
        const noteX = parseFloat(rect.getAttribute('x') || '0');

        if (noteY >= staveYPos - 50 && noteY <= staveYPos + 60) {
          const isRest = noteHeight < 20;
          staveNotes.push({ x: noteX, isRest });
        }
      }
    });

    staveNotes.sort((a, b) => a.x - b.x);
    const nonRestNotes = staveNotes.filter(n => !n.isRest);

    if (nonRestNotes.length > 0) {
      const firstNoteX = nonRestNotes[0].x;
      const lastNoteX = nonRestNotes[nonRestNotes.length - 1].x + 12;
      const textWidth = lastNoteX - firstNoteX;

      const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textEl.setAttribute('x', String(firstNoteX));
      textEl.setAttribute('y', String(lyricsY));
      textEl.setAttribute('class', 'lyrics-line');
      textEl.setAttribute('fill', 'currentColor');
      textEl.setAttribute('font-size', `${lyricsFontSize}px`);
      textEl.setAttribute('textLength', String(textWidth));
      textEl.setAttribute('lengthAdjust', 'spacing');
      textEl.textContent = measure.lyrics;
      vexflowGroup.appendChild(textEl);
    }
  }

  function getCenteredChordX(
    staveNotes: { x: number; width: number }[],
    position: number,
    duration?: number
  ): number | null {
    const startNote = staveNotes[position];
    if (!startNote) return null;

    const chordSpan = Math.max(duration ?? 1, 1);
    const endIndex = Math.min(position + chordSpan - 1, staveNotes.length - 1);
    const endNote = staveNotes[endIndex] ?? startNote;
    const startCenter = startNote.x + (startNote.width / 2);
    const endCenter = endNote.x + (endNote.width / 2);

    return (startCenter + endCenter) / 2;
  }

  function placeChordLabel(
    parent: SVGGElement | SVGSVGElement,
    x: number,
    y: number,
    symbol: string,
    previousRightEdge: number | null
  ): number {
    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', String(x));
    textEl.setAttribute('y', String(y));
    textEl.setAttribute('class', 'chord-symbol');
    textEl.setAttribute('fill', 'currentColor');
    textEl.setAttribute('font-size', `${CHORD_FONT_SIZE}px`);
    textEl.setAttribute('font-weight', '600');
    textEl.setAttribute('text-anchor', 'middle');
    textEl.textContent = symbol;
    parent.appendChild(textEl);

    let bbox = textEl.getBBox();

    if (previousRightEdge !== null) {
      const minimumLeftEdge = previousRightEdge + CHORD_MIN_GAP;
      if (bbox.x < minimumLeftEdge) {
        const adjustedX = x + (minimumLeftEdge - bbox.x);
        textEl.setAttribute('x', String(adjustedX));
        bbox = textEl.getBBox();
      }
    }

    return bbox.x + bbox.width;
  }

  function renderStaff() {
    if (!containerRef) return;
    if (transposedMeasures.length === 0) {
      containerRef.innerHTML = '';
      return;
    }

    const measuredWidth = containerRef.clientWidth || containerWidth;
    if (measuredWidth <= 0) return;

    const dimensions = calculateMultiLineDimensions(transposedMeasures.length, measuredWidth, showLyrics, showChords, scale);

    const config: RenderConfig = {
      width: dimensions.width,
      keySignature: displayKey,
      timeSignature,
      showLyrics,
      showChords,
      scale,
    };

    try {
      renderMultiLineMelody(containerRef, transposedMeasures, config);
    } catch (e) {
      console.error('[StaffDisplay] VexFlow rendering failed:', e);
      return;
    }

    if (transposedMeasures.length === 0) {
      return;
    }

    // Add lyrics text below each staff line after rendering
    if (showLyrics) {
        const svg = containerRef.querySelector('svg');
        if (svg) {
          // Find the VexFlow transform group to append text inside it
          // VexFlow wraps content in a group with the scale transform
          const vexflowGroup = svg.querySelector('g') || svg;
          
          // Use a fixed small font size that won't overlap at any zoom level
          // At higher zoom, notes are closer in coordinate space, so we need small text
          const lyricsFontSize = 11;
          
          // Get all staves to find note positions per line
          const staves = svg.querySelectorAll('.vf-stave');
          
          transposedMeasures.forEach((measure, index) => {
            // Check if this measure has per-note syllables
            const hasSyllables = measure.notes.some(n => n.syllable && n.syllable !== '_');
            
            if (hasSyllables) {
              // New per-note syllable rendering
              const stave = staves[index];
              if (stave) {
                const stavePath = stave.querySelector('path');
                const staveYPos = stavePath ? parseFloat(stavePath.getAttribute('d')?.split(' ')[1] || '0') : 0;
                
                // Position lyrics below the stave: stave top + 40 (5 lines) + offset for notes below staff
                const lyricsY = staveYPos + 70; // 40 for staff height + 30 for clearance
                
                // Find all stavenotes that belong to this stave (by Y position proximity)
                // This includes both notes AND rests - VexFlow renders both as .vf-stavenote
                const allNotes = svg.querySelectorAll('.vf-stavenote');
                const staveNotes: {x: number, width: number}[] = [];
                
                allNotes.forEach((note) => {
                  const rect = note.querySelector('rect');
                  if (rect) {
                    const noteY = parseFloat(rect.getAttribute('y') || '0');
                    const noteX = parseFloat(rect.getAttribute('x') || '0');
                    const noteWidth = parseFloat(rect.getAttribute('width') || '12');
                    
                    // Check if this note belongs to this stave (within vertical range)
                    // Use tighter range to avoid overlap with adjacent staves (lineHeight is ~95-125)
                    if (noteY >= staveYPos - 50 && noteY <= staveYPos + 60) {
                      staveNotes.push({ x: noteX, width: noteWidth });
                    }
                  }
                });
                
                // Sort by X position to match the order of notes in the measure
                staveNotes.sort((a, b) => a.x - b.x);
                
                // Data notes and SVG notes are in the same order (both include rests)
                // We iterate through both together, placing syllables only for non-rest notes
                const allMeasureNotes = measure.notes;

                if (staveNotes.length !== allMeasureNotes.length) {
                  renderWholeLineLyrics(svg, vexflowGroup, staves, measure, index, lyricsFontSize);
                  return;
                }

                // Find the last syllable index for special end-alignment
                let lastSyllableDataIdx = -1;
                allMeasureNotes.forEach((n, i) => {
                  if (!n.rest && n.syllable && n.syllable !== '_') {
                    lastSyllableDataIdx = i;
                  }
                });
                
                // Iterate through data notes and corresponding SVG notes together
                allMeasureNotes.forEach((noteData, dataIdx) => {
                  // Get corresponding SVG note (same index - both arrays include rests)
                  const svgNote = staveNotes[dataIdx];
                  
                  // Skip rests - they don't get syllables
                  if (noteData.rest) {
                    return;
                  }
                  
                  // Only render if there's a syllable and we have a corresponding SVG element
                  if (noteData.syllable && noteData.syllable !== '_' && svgNote) {
                    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    const centerX = svgNote.x + (svgNote.width / 2);
                    
                    // Check if this is the last syllable in the measure
                    const isLastSyllable = dataIdx === lastSyllableDataIdx;
                    
                    if (isLastSyllable) {
                      textEl.setAttribute('x', String(svgNote.x + svgNote.width));
                      textEl.setAttribute('text-anchor', 'end');
                    } else {
                      textEl.setAttribute('x', String(centerX));
                      textEl.setAttribute('text-anchor', 'middle');
                    }
                    
                    textEl.setAttribute('y', String(lyricsY));
                    textEl.setAttribute('class', 'lyrics-syllable');
                    textEl.setAttribute('fill', 'currentColor');
                    textEl.setAttribute('font-size', `${lyricsFontSize}px`);
                    textEl.textContent = noteData.syllable;
                    vexflowGroup.appendChild(textEl);
                  }
                });
              }
            } else if (measure.lyrics) {
              renderWholeLineLyrics(svg, vexflowGroup, staves, measure, index, lyricsFontSize);
            }
          });
        }
      }
      
    // Render chord symbols above the staff
    if (showChords) {
        const chordSvg = containerRef.querySelector('svg');
        if (chordSvg) {
          const chordVexflowGroup = chordSvg.querySelector('g') || chordSvg;
          const staves = chordSvg.querySelectorAll('.vf-stave');

          transposedMeasures.forEach((measure, index) => {
            if (!measure.chords || measure.chords.length === 0) return;

          const stave = staves[index];
          if (!stave) return;

          const stavePath = stave.querySelector('path');
          const staveYPos = stavePath ? parseFloat(stavePath.getAttribute('d')?.split(' ')[1] || '0') : 0;

            const chordsY = staveYPos - CHORD_VERTICAL_OFFSET;

            const allNotes = chordSvg.querySelectorAll('.vf-stavenote');
            const staveNotes: { x: number; width: number }[] = [];

          allNotes.forEach((note) => {
            const rect = note.querySelector('rect');
            if (rect) {
              const noteY = parseFloat(rect.getAttribute('y') || '0');
              const noteX = parseFloat(rect.getAttribute('x') || '0');
              const noteWidth = parseFloat(rect.getAttribute('width') || '12');

              if (noteY >= staveYPos - 50 && noteY <= staveYPos + 60) {
                staveNotes.push({ x: noteX, width: noteWidth });
              }
            }
          });

            staveNotes.sort((a, b) => a.x - b.x);
            let previousRightEdge: number | null = null;

            measure.chords.forEach((chord) => {
              const chordX = getCenteredChordX(staveNotes, chord.position, chord.duration);
              if (chordX === null) return;

              previousRightEdge = placeChordLabel(
                chordVexflowGroup,
                chordX,
                chordsY,
                chord.symbol,
                previousRightEdge
              );
            });
          });
        }
    }
  }

  function scheduleRender() {
    renderGeneration += 1;
    const currentGeneration = renderGeneration;
    clearScheduledRenders();

    renderFrameId = requestAnimationFrame(() => {
      renderFrameId = null;
      if (currentGeneration !== renderGeneration) return;

      renderStaff();

      if (typeof document !== 'undefined' && 'fonts' in document) {
        void document.fonts.ready.then(() => {
          if (currentGeneration !== renderGeneration) return;
          fontRenderFrameId = requestAnimationFrame(() => {
            fontRenderFrameId = null;
            if (currentGeneration !== renderGeneration) return;
            renderStaff();
          });
        });
      }
    });
  }

  $effect(() => {
    containerRef;
    containerWidth;
    transposedMeasures;
    displayKey;
    timeSignature;
    showLyrics;
    showChords;
    scale;

    scheduleRender();

    return () => {
      clearScheduledRenders();
    };
  });

  onMount(() => {
    // Set up resize observer for responsive rendering
    if (containerRef) {
      containerWidth = containerRef.clientWidth || 600;
      
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          containerWidth = entry.contentRect.width;
        }
      });
      
      resizeObserver.observe(containerRef);
      
      return () => resizeObserver.disconnect();
    }
  });
</script>

<div class="staff-display">
  <div
    bind:this={containerRef}
    class="staff-container"
    role="img"
    aria-label="Musical staff showing psalm melody"
  ></div>
</div>

<style>
  .staff-display {
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .staff-container {
    width: 100%;
    min-height: 100px;
    background: var(--staff-bg);
    border-radius: 8px;
    overflow-x: auto;
    padding: 0.25rem;
    padding-right: 1rem;
    /* Force dark color for musical notation on white background */
    color: #1a1a2e;
  }

  .staff-container :global(svg) {
    display: block;
    overflow: visible;
  }

  .staff-container :global(.lyrics-line) {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 17px;
    /* font-style: italic; */
    font-weight: 400;
    fill: #1a1a2e;
  }

  .staff-container :global(.lyrics-syllable) {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 17px;
    /* font-style: italic; */
    font-weight: 400;
    fill: #1a1a2e;
    letter-spacing: 0.3px;
  }

  .staff-container :global(.melisma-line) {
    stroke: #1a1a2e;
  }

  .staff-container :global(.chord-symbol) {
    font-family: 'Trebuchet MS', 'Avenir Next', 'Segoe UI', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.2px;
    fill: #1d4ed8;
    paint-order: stroke;
    stroke: rgba(255, 255, 255, 0.92);
    stroke-width: 1.4px;
    stroke-linejoin: round;
  }

  /* Mobile optimizations */
  @media (max-width: 640px) {
    .staff-container {
      padding: 0.15rem;
      padding-right: 0.5rem;
      min-height: 80px;
    }
  }
</style>
