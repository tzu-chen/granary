# Granary

A research log and spaced repetition system for mathematical self-study. Granary combines a daily research journal with a review card system — log entries capture what you learned and why, and entries can be promoted to reviewable cards for long-term retention via the FSRS-5 algorithm.

Built for studying stochastic analysis, functional analysis, measure theory, and related areas. Content is heavily mathematical with LaTeX throughout, rendered with KaTeX.

## Features

### Daily Research Log
The primary view. Entries are grouped by calendar date with an optional day summary composed of two layers:
- **Structured template** — Goals, Progress, and Open Questions sections (each independently collapsible and auto-saved)
- **Summary items** — additional topic blocks for separating study sessions within a day (e.g., "morning: measure theory", "afternoon: arXiv papers")

### Rich Entry Types
Ten entry types with distinct visual treatments:
- `definition`, `theorem` — styled header blocks (textbook-style environments)
- `proof_sketch` — collapsible by default
- `counterexample` — warning-colored accent
- `exercise` — tracks solved/unsolved status
- `question` — open question with priority tracking (high/medium/low)
- `insight`, `note`, `example` — general-purpose entries

### Spaced Repetition (FSRS-5)
Entries can be promoted to review cards. Cards use the FSRS-5 scheduling algorithm (not SM-2) with four card types:
- **Prompt/Response** — freeform question and answer
- **Cloze** — content with cloze deletions
- **State Theorem** — theorem name → precise statement
- **Proof Idea** — theorem statement → proof sketch

Review sessions present due cards one at a time with self-rating (Again / Hard / Good / Easy).

### Open Items Tracking
Questions and exercises default to `open` status on creation. Resolve them by writing a resolution note that links back to the original entry. Filter and sort open items by priority, type, tag, source, and age.

### Full-Text Search
SQLite FTS5-powered search across all entries, ranked by BM25 relevance. Combinable with filters for tag, source, entry type, date range, and status.

### Dashboard
- Entry creation heatmap (last 6 months)
- Review forecast (cards due per day, next 30 days)
- Retention rate chart over time
- Breakdowns by tag and source

### Cross-App Links
Entries can reference entities in sibling apps (Navigate, Scribe, Monolith) for provenance tracking.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, TypeScript 5 |
| Backend | Express 4, TypeScript 5 |
| Database | SQLite (better-sqlite3) with FTS5 |
| Math rendering | KaTeX |
| Charts | Recharts |
| Styling | CSS Modules with custom properties (light/dark themes) |
| Date handling | date-fns, CST (UTC-6 fixed offset) |

## Getting Started

### Prerequisites

- Node.js 18+

### Install

```bash
npm run install:all
```

This installs dependencies for the root, `server/`, and `client/` directories.

### Development

```bash
npm run dev
```

Starts both the frontend (Vite on port 5174) and backend (Express on port 3002) concurrently with hot reload.

You can also run them separately:

```bash
npm run dev:server   # Backend only
npm run dev:client   # Frontend only
```

The Vite dev server proxies `/api` requests to the Express backend.

### Build

```bash
npm run build
```

Compiles TypeScript and builds the Vite frontend for production.

### Production

```bash
npm run build
npm start
```

The production server serves both the API and the built frontend from `client/dist/`.

## Project Structure

```
granary/
├── package.json                  # Root scripts (concurrently for dev, install:all)
├── client/                       # React frontend (Vite)
│   ├── src/
│   │   ├── App.tsx               # Root component and routing
│   │   ├── main.tsx              # Entry point
│   │   ├── types.ts              # Shared TypeScript interfaces
│   │   ├── styles/global.css     # Design tokens, reset, themes
│   │   ├── components/           # Reusable UI components (CSS Modules)
│   │   ├── pages/                # Route-level page components
│   │   │   ├── LogPage/          # Daily research log (/)
│   │   │   ├── EntriesPage/      # Workbench: review, open items, search (/workbench)
│   │   │   ├── DashboardPage/    # Stats, heatmap, forecast (/dashboard)
│   │   │   ├── EntryDetailPage/  # Single entry view (/entries/:id)
│   │   │   └── EntryEditPage/    # Edit entry (/entries/:id/edit)
│   │   ├── services/             # REST API client layer
│   │   ├── hooks/                # Custom React hooks
│   │   └── contexts/             # React contexts (theme)
│   └── vite.config.ts
└── server/                       # Express backend
    ├── src/
    │   ├── index.ts              # Express entry point
    │   ├── db.ts                 # SQLite schema and migrations
    │   ├── routes/               # RESTful route handlers
    │   └── services/
    │       └── fsrs.ts           # FSRS-5 spaced repetition algorithm
    └── data/                     # Runtime data (gitignored)
        └── granary.db            # SQLite database (created at runtime)
```

## API

All endpoints are under the `/api` prefix. Key resource groups:

- **Entries** — CRUD, promote/demote to review cards, resolve/reopen, priority updates
- **Day Summaries** — structured template (goals/progress/open questions) and summary items per date
- **Review** — due cards, card CRUD, rating with FSRS scheduling
- **Open Items** — filtered list and aggregate stats for unresolved entries
- **Stats** — overview, heatmap, forecast, review history
- **Tags / Sources** — unique tags and sources with entry counts
- **Search** — full-text via FTS5 with BM25 ranking, combinable with all filters

## Related Projects

Granary is part of a personal research tooling ecosystem:

- [Navigate](https://github.com/tzu-chen/navigate) — arXiv paper management + AI chat
- [Scribe](https://github.com/tzu-chen/scribe) — study tool: PDFs, notes, flowcharts, questions
- [Monolith](https://github.com/tzu-chen/monolith) — local LaTeX editor with Tectonic backend

All four apps share the same tech stack and conventions.
