import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

// GET /:period_key — get goals for a period (e.g., "2026-W14" or "2026-04")
router.get('/:period_key', (req: Request, res: Response) => {
  try {
    const { period_key } = req.params;
    const row = db.prepare(
      'SELECT period_key, period_type, goals, updated_at FROM period_goals WHERE period_key = ?'
    ).get(period_key) as { period_key: string; period_type: string; goals: string | null; updated_at: string } | undefined;

    if (!row) {
      return res.json({ period_key, goals: null, updated_at: null });
    }

    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch period goals' });
  }
});

// PUT /:period_key — upsert goals for a period
router.put('/:period_key', (req: Request, res: Response) => {
  try {
    const { period_key } = req.params;
    const { goals, period_type } = req.body;

    if (!period_type || !['weekly', 'monthly'].includes(period_type)) {
      return res.status(400).json({ error: 'period_type must be "weekly" or "monthly"' });
    }

    const now = new Date().toISOString();
    const existing = db.prepare('SELECT period_key FROM period_goals WHERE period_key = ?').get(period_key);

    if (existing) {
      db.prepare('UPDATE period_goals SET goals = ?, updated_at = ? WHERE period_key = ?')
        .run(goals ?? null, now, period_key);
    } else {
      db.prepare('INSERT INTO period_goals (period_key, period_type, goals, updated_at) VALUES (?, ?, ?, ?)')
        .run(period_key, period_type, goals ?? null, now);
    }

    const row = db.prepare('SELECT * FROM period_goals WHERE period_key = ?').get(period_key);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save period goals' });
  }
});

export default router;
