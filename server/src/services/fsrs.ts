import db from '../db';

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

const RATING_MAP: Record<Rating, number> = { again: 1, hard: 2, good: 3, easy: 4 };

interface CardData {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: CardState;
  last_review: string | null;
}

interface FSRSResult {
  stability: number;
  difficulty: number;
  due_date: string;
  state: CardState;
  reps: number;
  lapses: number;
}

function getParams(): number[] {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('fsrs_parameters') as { value: string } | undefined;
  if (row) return JSON.parse(row.value);
  return [0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589, 1.5330, 0.1544, 1.0339, 1.9395, 0.1100, 0.2900, 2.2273, 0.2328, 2.9898, 0.5100, 0.6468];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getCSTDate(daysFromNow = 0): string {
  const now = new Date();
  const cstOffset = -6 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const cstMs = utcMs + cstOffset * 60000 + daysFromNow * 86400000;
  const cst = new Date(cstMs);
  return cst.toISOString().slice(0, 10);
}

function initStability(rating: number, w: number[]): number {
  return Math.max(w[rating - 1], 0.1);
}

function initDifficulty(rating: number, w: number[]): number {
  return clamp(w[4] - Math.exp(w[5] * (rating - 1)) + 1, 1, 10);
}

function nextStability(d: number, s: number, r: number, rating: number, w: number[]): number {
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus);
}

function nextStabilityAfterFail(d: number, s: number, r: number, w: number[]): number {
  return Math.max(w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]), 0.1);
}

function nextDifficulty(d: number, rating: number, w: number[]): number {
  const delta = d - w[6] * (rating - 3);
  return clamp(w[7] * initDifficulty(4, w) + (1 - w[7]) * delta, 1, 10);
}

function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

export function rateCard(card: CardData, rating: Rating): FSRSResult {
  const w = getParams();
  const g = RATING_MAP[rating];
  const now = getCSTDate();

  let elapsedDays = 0;
  if (card.last_review) {
    const lastMs = new Date(card.last_review).getTime();
    const nowMs = new Date().getTime();
    elapsedDays = Math.max((nowMs - lastMs) / 86400000, 0);
  }

  let newStability: number;
  let newDifficulty: number;
  let newState: CardState;
  let newReps = card.reps;
  let newLapses = card.lapses;

  if (card.state === 'new') {
    newStability = initStability(g, w);
    newDifficulty = initDifficulty(g, w);
    newReps = 1;
    if (g === 1) {
      newState = 'learning';
      newLapses = card.lapses + 1;
    } else {
      newState = 'review';
    }
  } else {
    const r = retrievability(elapsedDays, card.stability);
    newDifficulty = nextDifficulty(card.difficulty, g, w);
    newReps = card.reps + 1;

    if (g === 1) {
      newStability = nextStabilityAfterFail(newDifficulty, card.stability, r, w);
      newLapses = card.lapses + 1;
      newState = 'relearning';
    } else {
      newStability = nextStability(newDifficulty, card.stability, r, g, w);
      newState = 'review';
    }
  }

  const interval = Math.max(1, Math.round(newStability * 9));
  const dueDate = getCSTDate(interval);

  return {
    stability: newStability,
    difficulty: newDifficulty,
    due_date: dueDate,
    state: newState,
    reps: newReps,
    lapses: newLapses,
  };
}

export { getCSTDate };
