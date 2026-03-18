import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/:date_cst', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM day_summaries WHERE date_cst = ?').get(req.params.date_cst);
    if (!row) return res.status(404).json({ error: 'No summary for this date' });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch day summary' });
  }
});

router.put('/:date_cst', (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (content === undefined) return res.status(400).json({ error: 'Content is required' });

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO day_summaries (date_cst, content, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(date_cst) DO UPDATE SET content = ?, updated_at = ?
    `).run(req.params.date_cst, content, now, content, now);

    const row = db.prepare('SELECT * FROM day_summaries WHERE date_cst = ?').get(req.params.date_cst);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save day summary' });
  }
});

export default router;
