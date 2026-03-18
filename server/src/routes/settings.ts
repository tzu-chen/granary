import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.get('/:key', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key) as { key: string; value: string } | undefined;
    if (!row) return res.status(404).json({ error: 'Setting not found' });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

router.put('/:key', (req: Request, res: Response) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'Value is required' });

    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?
    `).run(req.params.key, value, value);

    res.json({ key: req.params.key, value });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

export default router;
