# Copilot Instructions

## Project Overview

This project is a mobile-friendly frontend web application for displaying single-note psalm melodies on a musical staff, with the ability to transpose the melody up or down by semitones while preserving musical correctness.

Key goals:
- Correct musical notation at all times
- Clear separation between melody data, transposition logic, and UI rendering
- Support for lyrics displayed between notes, selectable per verse
- Simple, maintainable code over premature optimization

---

## Tech Stack & Architecture

- Framework: Svelte
- Language: TypeScript
- Target: Browser-based, mobile-friendly
- Build tooling: Lightweight (Vite or SvelteKit preferred)

Guidelines:
- Prefer simple, idiomatic Svelte
- Use TypeScript types everywhere, especially for musical concepts
- Avoid unnecessary complexity or over-engineering

---

## Musical Domain Rules (CRITICAL)

### Melody Representation

- Melodies are monophonic (single note at a time)
- Represent notes using a music-theory-safe format, preferably via a music library abstraction
- Avoid manual string manipulation of notes unless unavoidable

Each melody note should minimally encode:
- Pitch (note name + octave)
- Duration (even if currently uniform)
- Optional lyric attachment point

### Transposition Rules

- Transposition is chromatic (semitone-based)
- Transposition range is technically unlimited
- UI is expected to stay within ~±3 semitones, but logic must not assume limits
- Transposition affects displayed notes, key signature (if applicable), and accidentals

Rules:
- Delegate transposition logic to a music library whenever possible
- Never hardcode semitone-to-note mappings
- Always assume accidentals are allowed

### Enharmonics

- Prefer musically correct spelling as determined by the library
- Do not implement custom enharmonic correction unless explicitly required
- Consistency and correctness are more important than user preference

---

## Recommended Music Libraries

Copilot is encouraged to suggest and use:
- @tonaljs/tonal for pitch and transposition logic
- vexflow for rendering musical staff notation

Rules:
- Use libraries for music theory and notation
- Do not reinvent music theory logic
- Keep library usage isolated in utility modules

---

## Psalm Data Model

Psalms are loaded from static files (e.g. JSON).

A psalm should support:
- Metadata (number, title, mode, etc.)
- One primary melody
- Optional secondary melody
- Multiple verses of text

Conceptual structure:
- Psalm
  - id
  - number
  - title
  - melodies[]
    - notes[]
    - defaultKey
  - verses[]

Guidelines:
- Keep data models flexible and extensible
- Never assume lyrics are always present
- Treat melody and text as independent but linkable

---

## Lyrics & Verse Display (VERY IMPORTANT)

- Lyrics can be displayed:
  - Not at all
  - As plain text
  - Interleaved between notes on the staff
- Default verse is verse 1
- User can select which verse is shown
- Text placement must not break musical layout

Rules:
- Keep lyric-to-note mapping explicit
- Avoid assumptions about syllable counts
- Favor clarity over compactness in lyric logic

---

## UI & UX Rules

### Main Screens

1. Psalm List Screen
   - List of psalms as buttons
   - Search box:
     - Search by psalm number
     - Search through verses (text)
   - Mobile-first layout

2. Psalm Detail Screen
   - Musical staff with melody
   - Optional lyrics between notes
   - Transpose controls

### Transposition Controls

- Buttons for:
  - +1 semitone
  - -1 semitone
- Optional preconfigured transpositions
  - Rendered as extra buttons (favorites)
- UI shows only the currently selected pitch
- Original pitch is the default

Rules:
- Do not show multiple pitch states at once
- Keep transposition state centralized and predictable

---

## Styling & Theming

- Support light and dark themes
- Theme switching should be simple and global
- Avoid inline styles
- Prefer CSS variables or framework-native theming

---

## Coding Style & Priorities

Priority order:
1. Musical correctness
2. Simplicity
3. Readability

Guidelines:
- Use clear domain-specific naming (e.g. transposeSemitone)
- Avoid magic numbers
- Comment musical assumptions explicitly
- Keep UI logic separate from music logic

---

## Explicit Non-Goals (For Now)

Do not add:
- Audio playback
- Automated tests
- Backend logic
- Authentication
- Premature optimizations

---

## Future-Friendly Constraints

- Code should be suitable for later mobile app wrapping
- Code should be suitable for commercial exposure
- Avoid experimental or unstable APIs
- Prefer maintainability over cleverness

---

## Summary for Copilot

This is a music-notation-first application.
Musical correctness is more important than UI tricks.
Use proven music libraries.
Keep everything simple, explicit, and readable.
