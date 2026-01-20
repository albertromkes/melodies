# Psalm Melodies - Utilities Guide

## OVERVIEW
Core musical logic, pitch manipulation, and platform integration utilities.

## STRUCTURE
- `transposition.ts`: Tonal.js-powered chromatic transposition and enharmonic respelling.
- `vexflow-renderer.ts`: Custom VexFlow wrapper for multiline melody and lyric rendering.
- `capacitor.ts`: Native platform detection and mobile UI lifecycle (StatusBar, SplashScreen).
- `index.ts`: Public API export hub for all utility modules.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Pitch manipulation | `transposition.ts` | Chromatic transposition and key awareness |
| Staff rendering | `vexflow-renderer.ts` | VexFlow SVG generation and multiline logic |
| Native features | `capacitor.ts` | Platform checks and plugin initialization |
| Format conversion | `transposition.ts` | Scientific notation ↔ VexFlow key mapping |
| Layout sizing | `vexflow-renderer.ts` | SVG dimension calculation for responsive staff |

## CONVENTIONS
- **Tonal.js for theory**: Never manually calculate intervals or note names. Use `Note.transpose()`, `Interval.fromSemitones()`, and `Note.simplify()`.
- **Musical Correctness**: Use `transposeNoteDataWithKey()` to handle context-aware accidentals and musica ficta properly.
- **VexFlow Isolation**: Keep all `vexflow` imports and canvas/SVG drawing logic contained within `vexflow-renderer.ts`.
- **Enharmonic Respelling**: Use `respellPitch()` to ensure notes match the target key's alteration (prefer flats in Ab, sharps in G).
- **Platform Safety**: Always check `isNativePlatform()` before calling Capacitor plugins to maintain web compatibility.
- **Unit Testing (Implicit)**: Utilities must be pure functions where possible, especially in `transposition.ts`, to ensure musical predictability.
