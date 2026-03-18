import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT tags FROM entries').all() as { tags: string }[];
    const tagCounts: Record<string, number> = {};

    for (const row of rows) {
      const tags: string[] = JSON.parse(row.tags);
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    const result = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

export default router;
