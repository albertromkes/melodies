<script lang="ts">
  import { onMount } from 'svelte';
  import type { Measure, NoteData } from '../types/music';
  import { transposeNotesWithKey, getTransposedKey } from '../utils/transposition';
  import { renderMultiLineMelody, calculateMultiLineDimensions, type RenderConfig } from '../utils/vexflow-renderer';

  interface Props {
    measures: Measure[];
    keySignature: string;
    timeSignature: [number, number];
    transposeSemitones: number;
    showLyrics: boolean;
    scale: number;
  }

  let { measures, keySignature, timeSignature, transposeSemitones, showLyrics, scale }: Props = $props();

  let containerRef: HTMLDivElement | null = $state(null);
  let containerWidth = $state(600);

  // Compute transposed key first (needed for note transposition with accidentals)
  let displayKey = $derived(getTransposedKey(keySignature, transposeSemitones));
  
  // Compute transposed measures with key-aware accidental handling
  let transposedMeasures = $derived(
    measures.map(m => ({
      ...m,
      notes: transposeNotesWithKey(m.notes, transposeSemitones, keySignature, displayKey),
    }))
  );

  // Re-render when dependencies change
  $effect(() => {
    if (containerRef && transposedMeasures.length > 0) {
      const dimensions = calculateMultiLineDimensions(transposedMeasures.length, containerWidth, showLyrics, scale);
      
      const config: RenderConfig = {
        width: dimensions.width,
        keySignature: displayKey,
        timeSignature: timeSignature,
        showLyrics: showLyrics,
        scale: scale,
      };

      renderMultiLineMelody(containerRef, transposedMeasures, config);
      
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
              // Legacy whole-line lyrics rendering (stretched text)
              const stave = staves[index];
              if (stave) {
                const stavePath = stave.querySelector('path');
                const staveYPos = stavePath ? parseFloat(stavePath.getAttribute('d')?.split(' ')[1] || '0') : 0;
                
                // Position lyrics below the stave
                const lyricsY = staveYPos + 70;
                
                const allNotes = svg.querySelectorAll('.vf-stavenote');
                const staveNotes: {x: number, isRest: boolean}[] = [];
                
                allNotes.forEach((note) => {
                  const rect = note.querySelector('rect');
                  if (rect) {
                    const noteY = parseFloat(rect.getAttribute('y') || '0');
                    const noteHeight = parseFloat(rect.getAttribute('height') || '0');
                    const noteX = parseFloat(rect.getAttribute('x') || '0');
                    
                    // Use tighter range to avoid overlap with adjacent staves
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
            }
          });
        }
      }
    }
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
    font-family: serif;
    font-size: 14px;
    font-style: italic;
    fill: #1a1a2e;
  }

  .staff-container :global(.lyrics-syllable) {
    font-family: serif;
    font-size: 14px;
    font-style: italic;
    fill: #1a1a2e;
    letter-spacing: 0.5px;
  }

  .staff-container :global(.melisma-line) {
    stroke: #1a1a2e;
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
