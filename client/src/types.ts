export type EntryType = 'insight' | 'definition' | 'theorem' | 'proof_sketch' | 'example' | 'counterexample' | 'exercise' | 'question' | 'note' | 'reference';

export type CardType = 'prompt_response' | 'cloze' | 'state_theorem' | 'proof_idea';

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface EntryLink {
  app: 'navigate' | 'scribe' | 'monolith';
  ref_type: 'arxiv_id' | 'paper_id' | 'note_id' | 'flowchart_node' | 'project';
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

export const PRIORITY_OPTIONS: { value: 'high' | 'medium' | 'low'; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const ENTRY_TYPES: { value: EntryType; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'insight', label: 'Insight' },
  { value: 'definition', label: 'Definition' },
  { value: 'theorem', label: 'Theorem' },
  { value: 'proof_sketch', label: 'Proof Sketch' },
  { value: 'example', label: 'Example' },
  { value: 'counterexample', label: 'Counterexample' },
  { value: 'exercise', label: 'Exercise' },
  { value: 'question', label: 'Question' },
  { value: 'reference', label: 'Reference' },
];
