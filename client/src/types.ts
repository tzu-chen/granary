export type EntryType = 'note' | 'question';

export type CardType = 'prompt_response' | 'cloze' | 'state_theorem' | 'proof_idea';

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface EntryLink {
  app: 'navigate' | 'scribe' | 'monolith' | 'pyramid' | 'granary';
  ref_type: 'arxiv_id' | 'paper_id' | 'note_id' | 'book_id' | 'flowchart_node' | 'project' | 'session_id' | 'file' | 'entry' | 'document' | 'map';
  ref_id: string;
  label?: string;
}

export type EntryStatus = 'open' | 'resolved' | null;
export type EntryPriority = 'high' | 'medium' | 'low' | null;

export interface Entry {
  id: string;
  content: string;
  tags: string[];
  entry_type: EntryType;
  source?: string;
  links: EntryLink[];
  is_reviewable: boolean;
  status: EntryStatus;
  priority: EntryPriority;
  created_at: string;
  updated_at: string;
}

export interface SummaryItem {
  id: string;
  date_cst: string;
  title: string;
  content?: string | null;
  tag?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface DaySummary {
  date_cst: string;
  goals: string | null;
  progress: string | null;
  open_questions: string | null;
  scratch: string | null;
  updated_at: string | null;
  items: SummaryItem[];
}

export interface ReviewCard {
  id: string;
  entry_id: string;
  card_type: CardType;
  front: string;
  back: string;
  stability: number;
  difficulty: number;
  due_date: string;
  last_review: string | null;
  reps: number;
  lapses: number;
  state: CardState;
  created_at: string;
  updated_at: string;
}

export interface DueCard extends ReviewCard {
  entry_content: string;
  entry_type: EntryType;
  entry_tags: string[];
  entry_source?: string;
}

export interface ReviewLogEntry {
  id: string;
  card_id: string;
  rating: ReviewRating;
  stability_before: number;
  stability_after: number;
  difficulty_before: number;
  difficulty_after: number;
  elapsed_days: number;
  review_duration_ms?: number;
  reviewed_at: string;
}

export interface StatsOverview {
  due_today: number;
  total_cards: number;
  by_state: { state: string; count: number }[];
  retention_rate: number;
}

export interface HeatmapEntry {
  date: string;
  count: number;
}

export interface ForecastEntry {
  due_date: string;
  count: number;
}

export interface ReviewHistoryEntry {
  date: string;
  total: number;
  correct: number;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface Resolution {
  id: string;
  entry_id: string;
  resolution_entry_id: string;
  resolved_at: string;
}

export interface EntryWithResolution extends Entry {
  resolution?: {
    id: string;
    resolution_entry_id: string;
    resolved_at: string;
    resolution_content: string;
    resolution_entry_type: string;
    resolution_tags: string[];
  };
  resolution_of?: {
    resolved_entry_id: string;
  };
}

export interface OpenStats {
  total: number;
  by_priority: { priority: string; count: number }[];
  by_entry_type: { entry_type: string; count: number }[];
  by_tag: { tag: string; count: number }[];
}

export interface ScribeBook {
  id: string;
  filename: string;
  subject: string | null;
}

export const PRIORITY_OPTIONS: { value: 'high' | 'medium' | 'low'; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const ENTRY_TYPES: { value: EntryType; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'question', label: 'Question' },
];

export type TaskState = 'planned' | 'in_progress' | 'done' | 'abandoned' | 'blocked';

export type TaskKind = 'goal' | 'task' | 'question';

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  kind: TaskKind;
  state: TaskState;
  state_reason: string | null;
  created_on: string;
  completed_on: string | null;
  kept_until: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export const TASK_STATES: { value: TaskState; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'abandoned', label: 'Abandoned' },
];

export const TASK_KINDS: { value: TaskKind; label: string }[] = [
  { value: 'goal', label: 'Goal' },
  { value: 'task', label: 'Task' },
  { value: 'question', label: 'Question' },
];

export type MapKind = 'reading' | 'writing' | 'code' | 'task';

export type MapStatus = 'planned' | 'active' | 'completed' | 'abandoned';

export type MapItemStatus = 'todo' | 'doing' | 'done' | 'skipped';

// Loose cross-app link shape (same shape as DocumentLink) — supports arbitrary apps.
export interface MapItemLink {
  app: string;
  ref_type: string;
  ref_id: string;
  label?: string;
}

export interface MapRecord {
  id: string;
  title: string;
  description?: string | null;
  goal?: string | null;
  goal_original?: string | null;
  status: MapStatus;
  status_reason?: string | null;
  progress_pct?: number | null;
  tags: string[];
  due_date?: string | null;
  position: number;
  completed_on?: string | null;
  created_at: string;
  updated_at: string;
  item_counts?: { total: number; done: number };
}

export interface MapItem {
  id: string;
  map_id: string;
  kind: MapKind;
  title: string;
  notes?: string | null;
  item_status: MapItemStatus;
  link?: MapItemLink | null;
  entry_id?: string | null;
  task_id?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export const MAP_STATUSES: { value: MapStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'abandoned', label: 'Abandoned' },
];

export const MAP_KINDS: { value: MapKind; label: string }[] = [
  { value: 'reading', label: 'Reading' },
  { value: 'writing', label: 'Writing' },
  { value: 'code', label: 'Code' },
  { value: 'task', label: 'Task' },
];

export const MAP_ITEM_STATUSES: { value: MapItemStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
  { value: 'skipped', label: 'Skipped' },
];

export interface DocumentLink {
  app: string;
  ref_type: string;
  ref_id: string;
  label?: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  tags: string[];
  source?: string | null;
  links: DocumentLink[];
  open_todo_count: number;
  total_todo_count: number;
  imported_from?: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  snippet?: string;
}

export interface DocumentStats {
  total: number;
  archived: number;
  with_open_todos: number;
  total_bytes: number;
  by_tag: { tag: string; count: number }[];
}

export interface DocumentFilters {
  search?: string;
  tag?: string;
  source?: string;
  start?: string;
  end?: string;
  has_open_todos?: boolean;
  archived?: boolean;
}

export const CROSS_APP_OPTIONS: { app: string; label: string; refTypes: { value: string; label: string }[] }[] = [
  {
    app: 'granary',
    label: 'Granary',
    refTypes: [
      { value: 'entry', label: 'Entry' },
      { value: 'document', label: 'Document' },
      { value: 'map', label: 'Map' },
    ],
  },
  {
    app: 'scribe',
    label: 'Scribe',
    refTypes: [
      { value: 'note_id', label: 'Note' },
      { value: 'book_id', label: 'Book' },
      { value: 'flowchart_node', label: 'Flowchart node' },
    ],
  },
  {
    app: 'navigate',
    label: 'Navigate',
    refTypes: [
      { value: 'arxiv_id', label: 'arXiv ID' },
      { value: 'paper_id', label: 'Paper' },
    ],
  },
  {
    app: 'monolith',
    label: 'Monolith',
    refTypes: [
      { value: 'project', label: 'Project' },
      { value: 'file', label: 'File' },
    ],
  },
  {
    app: 'pyramid',
    label: 'Pyramid',
    refTypes: [{ value: 'session_id', label: 'Session' }],
  },
];
