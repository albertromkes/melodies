# Scripts - Build Utilities

**Generated:** 2026-01-20
**Scope:** Search indexing & build-time data processing

## OVERVIEW
Node.js utilities for generating search indexes and metadata from raw psalm data.

## STRUCTURE
```
scripts/
└── build-search-index.mjs  # Primary search index generator
```

## WHERE TO LOOK
| Task | Script | Role |
|------|--------|------|
| **Search Indexing** | `build-search-index.mjs` | Generates `verses-index.json` via MiniSearch |
| **Metadata Generation**| `build-search-index.mjs` | Aggregates `songs-meta.json` and `categories.json` |
| **Build Hook** | `package.json` | Runs before `vite build` to ensure fresh indexes |

### DATA FLOW
1. **Inputs**: Reads `.json` files from `src/lib/data/` (organized by category folders)
2. **Processing**: Normalizes text (lowercase, punctuation stripping) and builds MiniSearch document store
3. **Outputs**: Writes to `public/search/`:
   - `categories.json`: Counted list of song categories
   - `songs-meta.json`: Lightweight index for listing (id, number, title, tags)
   - `verses-index.json`: Full-text search index for verse content

### CONVENTIONS
- **ESM only**: Use `.mjs` or `"type": "module"` for all scripts
- **Clean Text**: Use `normalizeText()` for consistent search results
- **Lazy Loading**: `verses-index.json` is large; the client must load it only when searching
