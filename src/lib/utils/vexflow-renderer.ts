/**
 * VexFlow rendering utilities for musical staff notation
 * Isolates all VexFlow-specific logic
 */

import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Barline } from 'vexflow';
import type { NoteData, Measure } from '../types/music';

/** Configuration for staff rendering */
export interface RenderConfig {
  /** Width of the rendering area */
  width: number;
  /** Key signature (e.g., "C", "G", "F") */
  keySignature: string;
  /** Time signature as [beats, beatUnit] */
  timeSignature: [number, number];
  /** Whether to show lyrics */
  showLyrics: boolean;
  /** Scale factor for notation size (default: 1.0) */
  scale?: number;
}

/** Configuration for a single line/stave */
interface LineConfig {
  notes: NoteData[];
  lyrics?: string;
  showClef: boolean;
  showKeySignature: boolean;
  showTimeSignature: boolean;
  isLastLine: boolean;
}

/**
 * Create VexFlow StaveNotes from note data
 * Notes are already in VexFlow format (keys: ["a/4"])
 * Handles cautionary accidentals (musica ficta) when specified
 */
function createStaveNotes(notes: NoteData[]): StaveNote[] {
  return notes.map((note) => {
    const duration = note.rest ? note.duration + 'r' : note.duration;
    
    const staveNote = new StaveNote({
      keys: note.keys,
      duration: duration,
    });
    
    // Add explicit accidental if specified (for musica ficta / cautionary accidentals)
    if (note.accidental) {
      const accidental = new Accidental(note.accidental.type);
      if (note.accidental.cautionary) {
        accidental.setAsCautionary();
      }
      staveNote.addModifier(accidental, 0); // Add to first key (index 0)
    }
    
    return staveNote;
  });
}

/**
 * Render a single line/stave
 */
function renderLine(
  context: ReturnType<Renderer['getContext']>,
  lineConfig: LineConfig,
  renderConfig: RenderConfig,
  staveX: number,
  staveY: number,
  staveWidth: number
): number {
  // Draw lyrics text above the staff if present
  if (renderConfig.showLyrics && lineConfig.lyrics) {
    // We'll add lyrics after the stave is created so we can use the container's SVG
  }
  
  // Create stave
  const stave = new Stave(staveX, staveY, staveWidth);
  
  if (lineConfig.showClef) {
    stave.addClef('treble');
  }
  if (lineConfig.showKeySignature) {
    stave.addKeySignature(renderConfig.keySignature);
  }
  if (lineConfig.showTimeSignature) {
    stave.addTimeSignature(`${renderConfig.timeSignature[0]}/${renderConfig.timeSignature[1]}`);
  }
  
  // Set end bar line type - double bar for last measure
  if (lineConfig.isLastLine) {
    stave.setEndBarType(Barline.type.END);
  }
  
  stave.setContext(context).draw();
  
  // Create notes
  const staveNotes = createStaveNotes(lineConfig.notes);
  
  if (staveNotes.length === 0) {
    return staveY + 95; // Return next Y position even for empty stave
  }
  
  // Create voice and add notes
  const voice = new Voice({
    numBeats: renderConfig.timeSignature[0],
    beatValue: renderConfig.timeSignature[1],
  }).setStrict(false);
  
  voice.addTickables(staveNotes);
  
  // Apply accidentals automatically based on key signature
  Accidental.applyAccidentals([voice], renderConfig.keySignature);
  
  // Format to fit stave, using options to reduce minimum width per note
  const formatter = new Formatter({ softmaxFactor: 10, globalSoftmax: true });
  formatter.joinVoices([voice]);
  formatter.formatToStave([voice], stave, { alignRests: true, stave: stave });
  
  // Draw the voice after positioning
  voice.draw(context, stave);
  
  // Return next Y position (line height - tighter spacing)
  return staveY + 95;
}

/**
 * Render multiple lines (measures) with lyrics above each line
 * @param container - DOM element to render into
 * @param measures - Array of measures, each becoming a line
 * @param config - Rendering configuration
 */
export function renderMultiLineMelody(
  container: HTMLDivElement,
  measures: Measure[],
  config: RenderConfig
): void {
  // Clear previous content
  container.innerHTML = '';
  
  if (measures.length === 0) {
    return;
  }
  
  // Apply scale (default 1.0)
  const scale = config.scale ?? 1.0;
  
  // Calculate total height needed (scaled)
  // Base line height of 95 units, plus space for lyrics below each line
  const lineHeight = 95;
  const lyricsSpace = config.showLyrics ? 30 : 0;
  // Total height in scaled pixels
  const totalHeight = (measures.length * (lineHeight + lyricsSpace) + 60) * scale;
  
  // Create renderer
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(config.width, totalHeight);
  const context = renderer.getContext();
  
  // Apply scale to the context
  context.scale(scale, scale);
  
  // Render each measure as a separate line (use unscaled coordinates since context is scaled)
  const staveWidth = (config.width / scale) - 20;
  const staveX = 10;
  let currentY = 40;
  
  measures.forEach((measure, index) => {
    const isLastMeasure = index === measures.length - 1;
    const lineConfig: LineConfig = {
      notes: measure.notes,
      lyrics: measure.lyrics,
      showClef: true, // Show clef on all lines
      showKeySignature: true, // Show key sig on all lines
      showTimeSignature: false, //index === 0, // Only show time sig on first line
      isLastLine: isLastMeasure,
    };
    
    currentY = renderLine(context, lineConfig, config, staveX, currentY, staveWidth);
    
    // Add space for lyrics below the staff
    if (config.showLyrics && measure.lyrics) {
      currentY += lyricsSpace;
    }
  });
}

/**
 * Render notes to a canvas/SVG element (legacy single-line mode)
 * @param container - DOM element to render into
 * @param notes - Array of notes in NoteData format
 * @param config - Rendering configuration
 */
export function renderMelody(
  container: HTMLDivElement,
  notes: NoteData[],
  config: RenderConfig & { height: number; syllables?: string[] }
): void {
  // Convert to single measure for backwards compatibility
  const measures: Measure[] = [{
    notes: notes,
  }];
  
  renderMultiLineMelody(container, measures, config);
}

/**
 * Calculate appropriate container dimensions for multi-line rendering
 */
export function calculateMultiLineDimensions(
  measureCount: number, 
  containerWidth: number,
  showLyrics: boolean,
  scale: number = 1.0
): { width: number; height: number } {
  const minWidth = Math.max(containerWidth, 300);
  // Base line height of 95 units, plus space for lyrics below each line
  const lineHeight = 95;
  const lyricsSpace = showLyrics ? 30 : 0;
  
  return {
    width: minWidth,
    // Total height in scaled pixels
    height: Math.max(200, (measureCount * (lineHeight + lyricsSpace) + 60) * scale),
  };
}

/**
 * Calculate appropriate container dimensions based on number of notes
 */
export function calculateDimensions(noteCount: number, containerWidth: number): { width: number; height: number } {
  const minWidth = Math.max(containerWidth, 300);
  
  return {
    width: minWidth,
    height: 200,
  };
}
