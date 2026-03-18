import { Router, Request, Response } from 'express';
import db from '../db';
import { rateCard as fsrsRate, getCSTDate, Rating } from '../services/fsrs';

const router = Router();

router.get('/due', (_req: Request, res: Response) => {
  try {
    const today = getCSTDate();
    const rows = db.prepare(`
      SELECT rc.*, e.content as entry_content, e.entry_type, e.tags as entry_tags, e.source as entry_source
      FROM review_cards rc
      JOIN entries e ON rc.entry_id = e.id
      WHERE rc.due_date <= ?
      ORDER BY rc.due_date ASC
    `).all(today) as Record<string, unknown>[];

    const cards = rows.map(row => ({
      ...row,
      entry_tags: JSON.parse(row.entry_tags as string),
    }));
    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch due cards' });
  }
});

router.get('/cards', (req: Request, res: Response) => {
  try {
    let query = 'SELECT * FROM review_cards';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (req.query.state) {
      conditions.push('state = ?');
      params.push(req.query.state);
    }
    if (req.query.entry_id) {
      conditions.push('entry_id = ?');
      params.push(req.query.entry_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

router.get('/cards/:id', (req: Request, res: Response) => {
  try {
    const card = db.prepare(`
      SELECT rc.*, e.content as entry_content, e.entry_type, e.tags as entry_tags
      FROM review_cards rc
      JOIN entries e ON rc.entry_id = e.id
      WHERE rc.id = ?
    `).get(req.params.id) as Record<string, unknown> | undefined;

    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json({
      ...card,
      entry_tags: JSON.parse(card.entry_tags as string),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

router.put('/cards/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM review_cards WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Card not found' });

    const { front, back } = req.body;
    const now = new Date().toISOString();

    db.prepare('UPDATE review_cards SET front = ?, back = ?, updated_at = ? WHERE id = ?')
      .run(front, back, now, req.params.id);

    const card = db.prepare('SELECT * FROM review_cards WHERE id = ?').get(req.params.id);
    res.json(card);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update card' });
  }
});

router.post('/cards/:id/rate', (req: Request, res: Response) => {
  try {
    const card = db.prepare('SELECT * FROM review_cards WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const { rating, duration_ms } = req.body;
    if (!['again', 'hard', 'good', 'easy'].includes(rating)) {
      return res.status(400).json({ error: 'Invalid rating' });
    }

    const result = fsrsRate({
      stability: card.stability as number,
      difficulty: card.difficulty as number,
      reps: card.reps as number,
      lapses: card.lapses as number,
      state: card.state as 'new' | 'learning' | 'review' | 'relearning',
      last_review: card.last_review as string | null,
    }, rating as Rating);

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE review_cards SET stability = ?, difficulty = ?, due_date = ?, state = ?,
        reps = ?, lapses = ?, last_review = ?, updated_at = ?
      WHERE id = ?
    `).run(
      result.stability, result.difficulty, result.due_date, result.state,
      result.reps, result.lapses, now, now, req.params.id
    );

    // Compute elapsed days for the log
    let elapsedDays = 0;
    if (card.last_review) {
      elapsedDays = Math.max((new Date().getTime() - new Date(card.last_review as string).getTime()) / 86400000, 0);
    }

    db.prepare(`
      INSERT INTO review_log (id, card_id, rating, stability_before, stability_after,
        difficulty_before, difficulty_after, elapsed_days, review_duration_ms, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(), req.params.id, rating,
      card.stability, result.stability,
      card.difficulty, result.difficulty,
      elapsedDays, duration_ms || null, now
    );

    const updated = db.prepare('SELECT * FROM review_cards WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to rate card' });
  }
});

export default router;
