import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare(
      `SELECT source, COUNT(*) as count FROM entries
       WHERE source IS NOT NULL AND source != ''
       GROUP BY source ORDER BY count DESC`
    ).all() as { source: string; count: number }[];

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

export default router;
