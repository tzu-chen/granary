# Granary — INTEROP.md

Cross-app integration spec for Granary. This documents the endpoints and data shapes that sibling apps (Navigate, Scribe, Monolith, Pyramid) may call or reference.

**Base URL:** `http://localhost:3009/api`  
**Port:** 3009 (server), 5174 (Vite dev)

---

## Data Available to Other Apps

### Entries

Granary is the source of truth for timestamped research log entries and their SRS review state.

**List entries (with filtering):**
```
GET /api/entries?date_cst=YYYY-MM-DD&tag=<tag>&entry_type=<type>&source=<source>&status=<status>&search=<query>
```
All query params are optional and combinable. When `search` is present, results are ranked by FTS5/BM25 relevance; otherwise newest-first.

Returns:
```typescript
interface Entry {
  id: string;                          // UUID
  content: string;                     // Markdown + KaTeX LaTeX
  tags: string[];                      // JSON array stored as TEXT
  entry_type: 'insight' | 'definition' | 'theorem' | 'proof_sketch' | 'example' | 'counterexample' | 'exercise' | 'question' | 'note';
  source: string | null;              // Free text: "Brezis Ch.4", "arXiv:2301.12345", etc.
  links: EntryLink[];                 // JSON array stored as TEXT (see below)
  is_reviewable: boolean;
  status: 'open' | 'resolved' | null;
  priority: 'high' | 'medium' | 'low' | null;
  created_at: string;                 // ISO 8601
  updated_at: string;
}

interface EntryLink {
  app: 'navigate' | 'scribe' | 'monolith' | 'pyramid' | 'granary';
  ref_type: 'arxiv_id' | 'paper_id' | 'note_id' | 'book_id' | 'flowchart_node' | 'project' | 'session_id' | 'entry' | 'document' | 'map';
  ref_id: string;
  label?: string;                     // Human-readable fallback — always set this. It's the only
                                       // readable trace of the link if the target is renamed/deleted.
}
```

**Get a single entry:**
```
GET /api/entries/:id
```
Includes resolution (if resolved) and resolution_of (if this entry is a resolution).

**Create an entry:**
```
POST /api/entries
```
Body: `{ content, entry_type, tags?, source?, links? }`. Auto-sets `status='open'` for questions/exercises.

### Open Items

**List all open entries:**
```
GET /api/open
```
Returns entries with `status='open'`, sorted by priority then age (oldest first).

**Open items stats:**
```
GET /api/open/stats
```
Returns counts by priority, entry_type, tag.

### Review Cards

**Get due cards:**
```
GET /api/review/due
```
Returns cards where `due_date <= today CST`, joined with entry content.

**List all cards:**
```
GET /api/review/cards?state=<state>&entry_id=<id>
```

```typescript
interface ReviewCard {
  id: string;
  entry_id: string;
  card_type: 'prompt_response' | 'cloze' | 'state_theorem' | 'proof_idea';
  front: string;              // Markdown + KaTeX
  back: string;               // Markdown + KaTeX
  stability: number;
  difficulty: number;
  due_date: string;           // YYYY-MM-DD
  last_review: string | null;
  reps: number;
  lapses: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
  created_at: string;
  updated_at: string;
}
```

### Day Summaries

**Get summary for a date:**
```
GET /api/day-summaries/YYYY-MM-DD
```
Returns `{ date_cst, goals, progress, open_questions, updated_at, items: SummaryItem[] }`.

### Tags

```
GET /api/tags
```
Returns `{ tag: string, count: number }[]` — all unique tags with entry counts.

### Stats

```
GET /api/stats/overview        → cards due, total by state, retention rate
GET /api/stats/heatmap?start=&end=  → entry creation counts by date
GET /api/stats/forecast?days=30     → cards due per day for next N days
GET /api/stats/review-history?start=&end=  → review log aggregated by date
```

### Maps

Granary's "Mapping" feature: a **map** is one bounded, completable unit of study/work, with a flat (non-hierarchical) list of heterogeneous `map_items` (reading/writing/code/task). See `CLAUDE.md` for the full data model and design rationale.

**List / get maps:**
```
GET /api/maps?status=&tag=&search=
GET /api/maps/:id
```
Returns maps (each with `item_counts: { total, done }`) and, for a single map, its ordered `map_items`.

**Map items may carry a cross-app link** (`map_items.link`, loose shape `{app, ref_type, ref_id, label?}` — see "How Granary References Other Apps" below) or an internal reference (`entry_id` / `task_id` into Granary's own `entries`/`tasks` tables). A sibling app resolving a map should read `link` the same way it resolves any other Granary-originated cross-app link.

**Liveness check:**
```
GET /api/maps/:id/resolve-links
```
Best-effort: pings each item's `link` target's existence-check endpoint (see table below) and returns per-item `ok`/`missing`/`unreachable`. Never blocks on a sibling app being down.

---

## Cross-App Reference Keys

When other apps link to Granary entities, use these identifiers:

| Entity | Key | Example |
|--------|-----|---------|
| Entry | `id` (UUID string) | `"a1b2c3d4-..."` |
| Entry (by content) | `source` + `entry_type` | Source: `"Brezis Ch.4"`, type: `"theorem"` |
| Document | `id` (UUID string) | `"b2c3d4e5-..."` |
| Map | `id` (UUID string) | `"c3d4e5f6-..."` |

Granary's own self-reference vocabulary (used when an entry/document/map links back into Granary itself, e.g. a map item pointing at an existing entry) is `ref_type` in (`entry`, `document`, `map`), with `ref_id` the target's UUID.

### How Granary References Other Apps

Granary entries and map items store cross-app links in a `links`/`link` JSON field. Every link should also carry a human-readable `label` — it's the only fallback that stays legible if the target is later renamed, moved, or deleted (this matters most for Monolith's `project`/`file` refs, which are directory/path-based and rename-fragile).

| Target App | Port (srv/vite) | ref_type | ref_id | Existence check | Example |
|------------|------------------|----------|--------|------------------|---------|
| Navigate | 3001 / 5173 | `arxiv_id` | arXiv ID string | `GET /api/papers` (filter by `arxiv_id`) | `"2301.12345"` |
| Navigate | 3001 / 5173 | `paper_id` | Navigate internal paper ID | `GET /api/papers` (filter by `paper_id`) | `"42"` |
| Scribe | 3003 / 5173 | `note_id` | Scribe note UUID | `GET /api/notes/:id` | `"a1b2c3d4-..."` |
| Scribe | 3003 / 5173 | `book_id` | Scribe attachment (book/PDF) UUID | `GET /api/attachments/:id` | `"b2c3d4e5-..."` |
| Scribe | 3003 / 5173 | `flowchart_node` | **Stable composite key** `"{flowchart_id}:{node_key}"` — **not** the node title, which rots on rename | `GET /api/flowcharts/nodes/:flowchartId/:nodeKey` | `"abc-123:hahn-banach"` |
| Monolith | 3005 / 5173 | `project` | Project directory name | `GET /api/projects` (list) | `"mfg-paper"` |
| Monolith | 3005 / 5173 | `file` | `project/relative/path.tex` | Switch project + `GET /api/files/:path` | `"mfg-paper/intro.tex"` |
| Pyramid | 3007 / 5177 | `session_id` | Pyramid session UUID | `GET /api/sessions/:id` | `"d4e5f6a7-..."` |

---

## Planned Endpoints for Cross-App Use (Not Yet Implemented)

| Consumer | Endpoint | Purpose |
|----------|----------|---------|
| Navigate | `POST /api/entries` | Auto-create a Granary entry when a paper is saved in Navigate (with arxiv_id link) |
| Scribe | `GET /api/entries?source=<book>&entry_type=theorem` | Fetch all theorems logged from a book, to populate Scribe flowchart nodes |
| Scribe | `POST /api/entries` | Push a Scribe question to Granary as an open item |
| Monolith | `GET /api/entries?tag=<project-tag>&is_reviewable=true` | Gather reviewed entries for a project, export as .tex |
