export type EntryType = 'insight' | 'definition' | 'theorem' | 'proof_sketch' | 'example' | 'counterexample' | 'exercise' | 'question' | 'note';

export type CardType = 'prompt_response' | 'cloze' | 'state_theorem' | 'proof_idea';

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface EntryLink {
  app: 'navigate' | 'scribe' | 'monolith';
  ref_type: 'arxiv_id' | 'paper_id' | 'note_id' | 'flowchart_node' | 'project';
  ref_id: string;
  label?: string;
}

export interface Entry {
  id: string;
  content: string;
  tags: string[];
  entry_type: EntryType;
  source?: string;
  links: EntryLink[];
  is_reviewable: boolean;
  created_at: string;
  updated_at: string;
}

export interface DaySummary {
  date_cst: string;
  content: string;
  updated_at: string;
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
];
