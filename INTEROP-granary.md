# Granary — INTEROP.md

Cross-app integration spec for Granary. This documents the endpoints and data shapes that sibling apps (Navigate, Scribe, Monolith) may call or reference.

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
  app: 'navigate' | 'scribe' | 'monolith';
  ref_type: 'arxiv_id' | 'paper_id' | 'note_id' | 'flowchart_node' | 'project';
  ref_id: string;
  label?: string;
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

---

## Cross-App Reference Keys

When other apps link to Granary entities, use these identifiers:

| Entity | Key | Example |
|--------|-----|---------|
| Entry | `id` (UUID string) | `"a1b2c3d4-..."` |
| Entry (by content) | `source` + `entry_type` | Source: `"Brezis Ch.4"`, type: `"theorem"` |

### How Granary References Other Apps

Granary entries store cross-app links in the `links` JSON field:

| Target App | ref_type | ref_id | Example |
|------------|----------|--------|---------|
| Navigate | `arxiv_id` | arXiv ID string | `"2301.12345"` |
| Navigate | `paper_id` | Navigate internal paper ID | `"42"` |
| Scribe | `note_id` | Scribe note UUID | `"a1b2c3d4-..."` |
| Scribe | `flowchart_node` | Flowchart node title | `"Hahn-Banach Theorem"` |
| Monolith | `project` | Project directory name | `"mfg-paper"` |

---

## Planned Endpoints for Cross-App Use (Not Yet Implemented)

| Consumer | Endpoint | Purpose |
|----------|----------|---------|
| Navigate | `POST /api/entries` | Auto-create a Granary entry when a paper is saved in Navigate (with arxiv_id link) |
| Scribe | `GET /api/entries?source=<book>&entry_type=theorem` | Fetch all theorems logged from a book, to populate Scribe flowchart nodes |
| Scribe | `POST /api/entries` | Push a Scribe question to Granary as an open item |
| Monolith | `GET /api/entries?tag=<project-tag>&is_reviewable=true` | Gather reviewed entries for a project, export as .tex |
