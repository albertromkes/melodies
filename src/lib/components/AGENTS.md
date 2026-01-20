# Psalm Melodies - Components Guidelines

## OVERVIEW
Core Svelte 5 UI components for psalm visualization, navigation, and musical interaction.

## STRUCTURE
```
src/lib/components/
├── PsalmDetail.svelte       # Main view controller & gesture orchestrator
├── StaffDisplay.svelte      # VexFlow SVG renderer with dynamic lyric placement
├── VerseSelector.svelte     # Verse navigation & lyrics visibility toggle
├── PsalmList.svelte         # Searchable index of all psalms
├── SongList.svelte          # Reusable list display for search results
├── TransposeControls.svelte # Pitch adjustment UI
└── ThemeToggle.svelte       # Global light/dark mode switcher
```

## WHERE TO LOOK
| Feature | Component | Implementation |
|---------|-----------|----------------|
| **Gesture System** | `PsalmDetail.svelte` | Manual `touchstart/end` handling in `$effect` |
| **Musical Notation** | `StaffDisplay.svelte` | VexFlow SVG generation + manual syllable injection |
| **Responsive Scaling** | `StaffDisplay.svelte` | `ResizeObserver` + `$state` for width tracking |
| **State Management** | `PsalmDetail.svelte` | `$state` for transpose, verse, and scale |
| **Search UI** | `PsalmList.svelte` | MiniSearch integration with reactive filtering |

## UNIQUE STYLES
- **Svelte 5 Runes**: Strict adherence to `$state()`, `$derived()`, and `$props()`. Avoid legacy Svelte 4 store patterns where runes suffice.
- **Gesture-First UX**: 
  - **Swiping**: Horizontal swipes on `PsalmDetail` switch verses.
  - **Double-Tap Zones**: Left/right screen edges for song navigation; staff top/bottom for transposition.
  - **Feedback**: Temporary overlay indicators (`gestureIndicator`) provide immediate visual confirmation of touch actions.
- **Hybrid SVG Rendering**: Combines VexFlow's automated staff generation with manual DOM-injected SVG text for precise Dutch syllable alignment under notes.
- **Mobile-First Constraints**: Components use `touch-action: manipulation` and fixed minimum tap targets (44px) to ensure reliability on iOS/Android WebViews.
