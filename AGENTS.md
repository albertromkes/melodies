# Psalm Melodies - Agent Guidelines

**Generated:** 2025-01-20
**Commit:** [update-mode]
**Branch:** main

## OVERVIEW
Svelte 5 + TypeScript mobile app for Dutch psalm melody notation with transposition.

## STRUCTURE
```
music-2/
├── src/lib/components/    # UI components (Svelte 5)
├── src/lib/utils/        # Music logic & platform tools
├── src/lib/data/         # Generated JSON psalms (150+ files)
├── scripts/              # Build utilities
├── android/ios/          # Capacitor mobile projects
└── [root scripts]        # PowerShell data pipeline
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Musical notation | `src/lib/utils/transposition.ts`, `src/lib/utils/vexflow-renderer.ts` | Core musical correctness |
| UI components | `src/lib/components/` | Svelte 5 runes throughout |
| Data generation | `generate-psalms.ps1` | PowerShell + Node pipeline |
| Mobile integration | `src/lib/utils/capacitor.ts` | Platform detection & lifecycle |
| Search indexing | `scripts/build-search-index.mjs` | MiniSearch build step |

## CODE MAP
| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| PsalmData | interface | src/lib/types/music.ts | Core | Domain model |
| transposeNote | function | src/lib/utils/transposition.ts | High | Pitch manipulation |
| renderStaff | function | src/lib/utils/vexflow-renderer.ts | High | VexFlow wrapper |
| $state | rune | src/App.svelte | High | Global state |

## CONVENTIONS
- **Svelte 5 only**: Use `$state()`, `$derived()`, `$effect()`, `$props()`
- **Musical correctness**: Delegate to `tonal` and `vexflow` - never manual pitch logic
- **Import order**: External libraries → Internal types → Components → Utils
- **Dutch syllabification**: Use `generate-psalms.ps1` script - never manual JSON edits

## ANTI-PATTERNS (THIS PROJECT)
- NEVER manually edit psalm JSON files - use PowerShell script
- NEVER hardcode music theory - use `tonal` package
- NEVER use `any` types - strict TypeScript only
- NEVER implement custom rendering - use `vexflow`
- NO automated tests - manual musical verification only

## UNIQUE STYLES
- Gesture-first mobile UX (swipe verses, double-tap transpose)
- Pre-computed data pipeline (ABC notation → JSON with Dutch syllabification)
- Theme synchronization between web and native mobile

## COMMANDS
```bash
npm run dev          # Development server
npm run build        # Build + search indexing
npm run check        # Type checking (svelte-check + tsc)
.\generate-psalms.ps1 -PsalmNumber 23  # Add psalm
npm run cap:sync     # Sync to mobile platforms
```

## NOTES
- Musical accuracy takes priority over code simplicity
- Data pipeline requires PowerShell + Node.js environment
- Mobile-first design with Capacitor deployment