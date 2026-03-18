# Granary — CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Granary is a **research log and spaced repetition system** for mathematical self-study. It combines a daily research journal with a review card system: log entries capture what you learned and why, and entries can be promoted to reviewable cards for long-term retention. The primary user studies topics in stochastic analysis, functional analysis, measure theory, and related areas — content is heavily mathematical with LaTeX throughout.

Granary is part of a personal research tooling ecosystem alongside three sibling projects:
- **Navigate** (arXiv paper management + AI chat) — https://github.com/tzu-chen/navigate
- **Scribe** (study tool: PDFs, notes, flowcharts, questions) — https://github.com/tzu-chen/scribe
- **Monolith** (local LaTeX editor with Tectonic backend) — https://github.com/tzu-chen/monolith

All four apps share the same tech stack and conventions. When in doubt, reference Navigate or Scribe for architectural patterns.

---

## Build & Development Commands

```
npm run install:all       # Install dependencies for root, server/, and client/
npm run dev               # Start both frontend (Vite) and backend (Express) concurrently
npm run dev:server        # Backend only (Express on port 3002, tsx watch for hot reload)
npm run dev:client        # Frontend only (Vite on port 5174)
npm run build             # Build both client and server for production
npm run build:client      # Build frontend only (tsc && vite build)
npm run build:server      # Build backend only (tsc)
npm start                 # Start production server (serves API + built frontend from client/dist/)
```

**Port assignment:** Granary uses port **3002** (server) and **5174** (Vite dev) to avoid conflicts with Navigate (3001/5173), Scribe (3001/5173 — run one at a time), and Monolith (3001/5173). The Vite dev server proxies `/api` requests to `http://localhost:3002`.

No `.env` files. The only server environment variable is `PORT` (defaults to 3002).

---

## Architecture

Full-stack TypeScript: React 18 + Vite frontend, Express + SQLite backend. Same structure as Navigate and Scribe.

```
forge/
├── package.json              # Root scripts (concurrently for dev, install:all)
├── client/                   # React frontend (Vite)
│   ├── src/
│   │   ├── main.tsx          # Entry point
│   │   ├── App.tsx           # Root component, routing, global state
│   │   ├── types.ts          # Shared TypeScript interfaces
│   │   ├── styles/
│   │   │   └── global.css    # CSS custom properties (design tokens), reset, themes
│   │   ├── components/       # Reusable UI components (one folder each)
│   │   ├── pages/            # Route-level page components
│   │   ├── services/         # Data access layer (REST API calls)
│   │   ├── hooks/            # Custom React hooks
│   │   └── contexts/         # React contexts (theme)
│   └── vite.config.ts        # Vite config with /api proxy to port 3002
└── server/                   # Express backend
    ├── src/
    │   ├── index.ts          # Express entry point, mounts route modules
    │   ├── db.ts             # SQLite schema init + migrations
    │   ├── routes/           # RESTful route handlers
    │   └── services/         # Business logic (database queries, scheduler, export)
    └── data/                 # Runtime data (gitignored)
        └── forge.db          # SQLite database
```

---

## Core Concepts

### Entries

The fundamental data unit. An entry is a timestamped piece of knowledge captured during study.

```typescript
interface Entry {
  id: string;                          // UUID
  content: string;                     // Markdown with LaTeX (KaTeX syntax)
  tags: string[];                      // JSON array stored as TEXT in SQLite
  entry_type: 'insight' | 'definition' | 'theorem' | 'proof_sketch' | 'example' | 'counterexample' | 'exercise' | 'question' | 'note';
  source?: string;                     // Free text: "Brezis Ch.4", "arXiv:2301.12345", etc.
  links: EntryLink[];                  // Cross-app references (see below)
  is_reviewable: boolean;              // Whether this entry has been promoted to SRS
  created_at: string;                  // ISO 8601
  updated_at: string;                  // ISO 8601
}
```

**Entry types** matter for display and card generation:
- `definition` / `theorem` — rendered with a styled header block (like a textbook environment)
- `proof_sketch` — collapsible by default
- `counterexample` — visually distinct (warning-colored accent)
- `exercise` — tracks solved/unsolved status
- `insight` / `note` — plain entries, the default journal mode
- `question` — an open question to revisit later

### Review Cards

When an entry is promoted to reviewable, a card is created. Cards are the SRS-facing view of an entry.

```typescript
interface ReviewCard {
  id: string;                          // UUID
  entry_id: string;                    // FK → entries
  card_type: 'prompt_response' | 'cloze' | 'state_theorem' | 'proof_idea';
  front: string;                       // Markdown+LaTeX — the prompt
  back: string;                        // Markdown+LaTeX — the expected response
  // FSRS fields
  stability: number;                   // FSRS stability (days)
  difficulty: number;                  // FSRS difficulty (0-10)
  due_date: string;                    // ISO 8601 date (YYYY-MM-DD)
  last_review: string | null;          // ISO 8601 datetime
  reps: number;                        // Total review count
  lapses: number;                      // Times forgotten (rated "Again")
  state: 'new' | 'learning' | 'review' | 'relearning';
  created_at: string;
  updated_at: string;
}
```

**Card types:**
- `prompt_response` — freeform question/answer (user writes both sides)
- `cloze` — content with `{{c1::hidden}}` cloze deletions in the front field
- `state_theorem` — front is the theorem name, back is the precise statement (auto-generated from `theorem` entries)
- `proof_idea` — front is the theorem statement, back is the proof sketch (auto-generated from `proof_sketch` entries linked to a `theorem` entry)

### Cross-App Links

Entries can link to entities in the sibling apps. Links are informational — Granary does not call sibling APIs (yet). They exist so you can trace provenance.

```typescript
interface EntryLink {
  app: 'navigate' | 'scribe' | 'monolith';
  ref_type: 'arxiv_id' | 'paper_id' | 'note_id' | 'flowchart_node' | 'project';
  ref_id: string;                      // The foreign ID (e.g., "2301.12345", a UUID, a project name)
  label?: string;                      // Human-readable display label
}
```

### Daily Log View

The primary view. Shows entries grouped by calendar date (CST, UTC-6 fixed offset — same convention as Scribe's reading time tracking). Each day has an optional **day summary** field at the top (a short free-text note: today's goals, what happened, open questions). The log is scrollable and infinite — load more days as you scroll up.

### Review Session View

A drill session. Pulls all cards where `due_date <= today`, presents them one at a time. The user sees the front, mentally answers, reveals the back, then self-rates: **Again** (forgot), **Hard**, **Good**, **Easy**. The FSRS algorithm updates stability/difficulty/due_date accordingly.

### Dashboard / Stats View

Shows review statistics: cards due today, upcoming forecast (next 7/30 days), retention rate over time, heatmap of entries created per day (similar to Scribe's reading time heatmap). Also shows entries by tag and by source, so you can see coverage across books/topics.

---

## Database Schema (`server/data/forge.db`)

SQLite database created at runtime. WAL mode, foreign keys enabled.

```sql
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',          -- JSON array of strings
  entry_type TEXT NOT NULL DEFAULT 'note'
    CHECK (entry_type IN ('insight', 'definition', 'theorem', 'proof_sketch', 'example', 'counterexample', 'exercise', 'question', 'note')),
  source TEXT,
  links TEXT NOT NULL DEFAULT '[]',         -- JSON array of EntryLink objects
  is_reviewable INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,                 -- ISO 8601
  updated_at TEXT NOT NULL                  -- ISO 8601
);

CREATE TABLE IF NOT EXISTS day_summaries (
  date_cst TEXT PRIMARY KEY,                -- YYYY-MM-DD in CST
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_cards (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'prompt_response'
    CHECK (card_type IN ('prompt_response', 'cloze', 'state_theorem', 'proof_idea')),
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,                   -- YYYY-MM-DD
  last_review TEXT,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'new'
    CHECK (state IN ('new', 'learning', 'review', 'relearning')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS review_log (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  stability_before REAL NOT NULL,
  stability_after REAL NOT NULL,
  difficulty_before REAL NOT NULL,
  difficulty_after REAL NOT NULL,
  elapsed_days REAL NOT NULL,              -- Days since last review
  review_duration_ms INTEGER,              -- How long user spent on this card
  reviewed_at TEXT NOT NULL,               -- ISO 8601 datetime
  FOREIGN KEY (card_id) REFERENCES review_cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

**Indices:**
- `entries.created_at` — for date-range log queries
- `entries.entry_type` — for filtering
- `entries.is_reviewable` — for card management views
- `review_cards.entry_id` — FK lookup
- `review_cards.due_date` — for fetching due cards
- `review_cards.state` — for stats
- `review_log.card_id` — for per-card history
- `review_log.reviewed_at` — for stats over time

**JSON columns:** `tags` and `links` are stored as JSON TEXT. Parse with `JSON.parse()` in route handlers, serialize with `JSON.stringify()` on write. Same pattern as Navigate's `authors`/`categories` and Scribe's `tags`.

---

## API Endpoints

All under `/api` prefix. RESTful verbs. Parameterized SQL only — no string interpolation in queries.

### Entries

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/entries` | List entries. Query params: `date_cst` (single day), `start`/`end` (range), `tag`, `entry_type`, `source`, `is_reviewable`, `search` (full-text on content). Returns newest first. |
| GET | `/api/entries/:id` | Get single entry |
| POST | `/api/entries` | Create entry |
| PUT | `/api/entries/:id` | Update entry |
| DELETE | `/api/entries/:id` | Delete entry (cascades to review_cards → review_log) |
| POST | `/api/entries/:id/promote` | Create review card(s) for entry, set `is_reviewable = 1`. Body: `{ cards: [{ card_type, front, back }] }` |
| DELETE | `/api/entries/:id/demote` | Remove all review cards for entry, set `is_reviewable = 0` |

### Day Summaries

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/day-summaries/:date_cst` | Get summary for a date |
| PUT | `/api/day-summaries/:date_cst` | Upsert summary for a date |

### Review Cards

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/review/due` | Get all cards due today (`due_date <= today CST`). Returns cards joined with entry content. |
| GET | `/api/review/cards` | List all cards. Query params: `state`, `entry_id`. |
| GET | `/api/review/cards/:id` | Get single card with entry |
| PUT | `/api/review/cards/:id` | Update card front/back (manual edit) |
| POST | `/api/review/cards/:id/rate` | Submit a review rating. Body: `{ rating: 'again'|'hard'|'good'|'easy', duration_ms?: number }`. Runs FSRS, updates card, inserts review_log row. Returns updated card. |

### Stats

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats/overview` | Cards due today, total cards by state, retention rate (last 30 days) |
| GET | `/api/stats/heatmap` | Entry creation counts by date (for heatmap). Query params: `start`, `end`. |
| GET | `/api/stats/forecast` | Cards coming due per day for next N days. Query param: `days` (default 30). |
| GET | `/api/stats/review-history` | Review log aggregated by date. Query params: `start`, `end`. |

### Tags

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tags` | List all unique tags with entry counts |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Get all settings |
| GET | `/api/settings/:key` | Get single setting |
| PUT | `/api/settings/:key` | Set a setting. Body: `{ value: string }` |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | `{ status: 'ok', timestamp: ... }` |

### Error Responses

HTTP status codes: 201 (created), 400 (bad input), 404 (not found), 409 (conflict/duplicate), 500 (server error). Error body: `{ error: 'descriptive message' }`. Every route handler wrapped in try-catch.

---

## FSRS Algorithm

Use the **FSRS-5** algorithm (Free Spaced Repetition Scheduler). This is a ~50-line core implementation. Key points:

- **Do not use Anki's SM-2.** Use FSRS.
- Default parameters (w0–w18) from the FSRS-5 paper. Store them in the `settings` table so they can be tuned later.
- Card states: `new` → `learning` → `review`. On lapse: `review` → `relearning` → `review`.
- Rating maps: Again=1, Hard=2, Good=3, Easy=4.
- The `rate` endpoint must: (1) compute new stability/difficulty from FSRS formulas, (2) compute next due_date, (3) update the card row, (4) insert a review_log row.
- Reference implementation: https://github.com/open-spaced-repetition/fsrs.js — but implement it directly in the server service layer, not as a dependency. Keep it in a single file `server/src/services/fsrs.ts`.

---

## Client Views & Routing

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `LogPage` | Daily research log (default view) |
| `/review` | `ReviewPage` | Spaced repetition review session |
| `/dashboard` | `DashboardPage` | Stats, heatmap, forecast |
| `/entries/:id` | `EntryDetailPage` | Single entry view with its review cards |
| `/entries/:id/edit` | `EntryEditPage` | Edit an entry |

### LogPage (/)

The main view. Layout:
- **Date header** with navigation arrows (← yesterday, today, tomorrow →) and a date picker
- **Day summary** block at top (editable inline, auto-saves with 1500ms debounce — same pattern as Scribe's `useAutoSave`)
- **Entry list** for the selected date, newest first
- **New entry form** at bottom: content textarea (Markdown+LaTeX), entry_type selector, tags input, source input, optional links
- Entries are editable inline (click to expand editor) or via the detail page
- Each entry shows a "Promote to review" button if not yet reviewable, or a badge showing card count + next due date if already reviewable

### ReviewPage (/review)

- Shows count of due cards at top
- Presents one card at a time: front → (user thinks) → reveal back → rate (Again/Hard/Good/Easy)
- Cards render Markdown+LaTeX on both sides using KaTeX
- After rating, immediately shows the next card
- When done, shows session summary: cards reviewed, average rating, time spent
- If no cards due, shows a message with next due date

### DashboardPage (/dashboard)

- **Due today** count (prominent)
- **Heatmap** of entries created per day (last 6 months, same style as Scribe's reading time heatmap)
- **Forecast chart** — bar chart of cards coming due per day (next 30 days), using Recharts
- **Retention chart** — line chart of % correct (rated Good or Easy) over time
- **Tag breakdown** — entries per tag
- **Source breakdown** — entries per source

### EntryDetailPage (/entries/:id)

- Full entry display with rendered Markdown+LaTeX
- List of associated review cards with their SRS state, due date, review count
- Button to add another card from this entry
- Review history for each card (mini-timeline of past ratings)

---

## Key Dependencies

**Frontend:** React 18, Vite 6, TypeScript 5, KaTeX 0.16 (for LaTeX rendering in entries and cards), Recharts (for dashboard charts), date-fns (date utilities), uuid (ID generation)

**Backend:** Express 4, TypeScript 5, better-sqlite3 11+, cors, tsx (dev)

**Do NOT add:** react-pdf (not needed), any SRS library (implement FSRS directly), any ORM, any state management library (use React hooks + prop drilling from App.tsx, same as Navigate). No MathJax — use KaTeX exclusively for faster rendering.

---

## Conventions

### Code Style

Follow the exact conventions from Navigate and Scribe:

- **TypeScript strict mode** in both client and server tsconfig
- **Naming:** camelCase for variables/functions, PascalCase for components/interfaces/types, snake_case for database columns and table names, UPPER_CASE for constants
- **Imports:** Named imports from libraries, relative paths for local files
- **No linter or formatter config** — follow existing code style in each file

### Component Structure

Same as Scribe:
- Each component in its own folder: `components/ComponentName/ComponentName.tsx` + `ComponentName.module.css`
- Pages: `pages/PageName/PageName.tsx` + `PageName.module.css`
- **CSS Modules** exclusively — no utility-class frameworks (no Tailwind)
- Design tokens as CSS custom properties in `global.css` under `:root` and `[data-theme="dark"]`

### Theming

Two themes: light (default) and dark. Same mechanism as Scribe:
- Toggle by setting `data-theme="dark"` on `document.documentElement`
- Persist to localStorage via a `themeStorage` service (key: `forge_theme`)
- Consume through a `ThemeContext`
- Use CSS custom properties from `global.css` everywhere — never hard-code colors

Design token naming convention (match Scribe's pattern):
```css
:root {
  --color-bg-primary: ...;
  --color-bg-secondary: ...;
  --color-bg-tertiary: ...;
  --color-text-primary: ...;
  --color-text-secondary: ...;
  --color-text-muted: ...;
  --color-border: ...;
  --color-accent: ...;
  --color-accent-hover: ...;
  --color-success: ...;
  --color-warning: ...;
  --color-danger: ...;
  --color-info: ...;
  /* Entry type accent colors */
  --color-entry-definition: ...;
  --color-entry-theorem: ...;
  --color-entry-proof: ...;
  --color-entry-counterexample: ...;
  --color-entry-exercise: ...;
  --color-entry-question: ...;
}
```

### Service Layer

Same pattern as Scribe:
- Services are **plain objects** (not classes) exported as `const serviceName = { ... }`
- Server-backed services are async, use `fetch()` to call the REST API
- Client-only services (theme, any UI prefs) use localStorage and may be synchronous
- Services do NOT use React hooks
- Hooks wrap services and expose React state + callbacks

### Server Conventions

Same as Navigate and Scribe:
- Routes in `server/src/routes/` — one file per resource
- Database schema and init in `server/src/db.ts`
- JSON columns stored as TEXT, parsed/serialized in route handlers
- CORS enabled (allows `*` origin) for LAN access from iPad and other devices
- Parameterized SQL only — no string interpolation in queries
- Route-level try-catch wrapping all handlers

### LaTeX Rendering

Use **KaTeX** for all math rendering. Same syntax as Scribe's notes:
- Inline math: `$expression$` or `\(expression\)`
- Display math: `$$expression$$` or `\[expression\]`
- Use a shared `renderMarkdownWithLatex` utility component that processes Markdown and renders LaTeX blocks via KaTeX

### Date Handling

All dates stored and computed in **CST (UTC-6, fixed offset)** — same convention as Scribe. Do not adjust for CDT. The `due_date` field on review cards is a date string (YYYY-MM-DD) in CST. "Today" for review purposes means the current CST date.

### ID Generation

Use `crypto.randomUUID()` for all IDs (entries, cards, review log). Same as Scribe.

---

## Testing

No test framework configured. Validate changes by running `npm run build` (runs `tsc` for both client and server, catching type errors).

---

## Adding a New Entry Type

1. Add the value to the `entry_type` CHECK constraint in `server/src/db.ts` (requires migration or rebuild)
2. Add to the `EntryType` union type in `client/src/types.ts`
3. Add rendering logic in the entry display component (styled header, accent color)
4. Add a CSS variable `--color-entry-<type>` in `global.css`
5. Optionally add auto-card-generation logic if the type maps to a card pattern

## Adding a New Card Type

1. Add the value to the `card_type` CHECK constraint in `server/src/db.ts`
2. Add to the `CardType` union type in `client/src/types.ts`
3. Add rendering logic in the review card display (how front/back are presented)
4. If auto-generated: add generation logic in the promote endpoint

## Adding a New API Endpoint

1. Create or edit a route file in `server/src/routes/`
2. Register the router in `server/src/index.ts` with `app.use('/api/...', router)`
3. If new tables are needed, add `CREATE TABLE IF NOT EXISTS` in `server/src/db.ts`

## Adding a New Page

1. Create `client/src/pages/NewPage/NewPage.tsx` + `NewPage.module.css`
2. Add a `<Route>` in `client/src/App.tsx`
3. Add a nav link in the layout component
