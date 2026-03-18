import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

// GET /:date_cst — get summary template + items for a date
router.get('/:date_cst', (req: Request, res: Response) => {
  try {
    const { date_cst } = req.params;
    const row = db.prepare(
      'SELECT date_cst, goals, progress, open_questions, updated_at FROM day_summaries WHERE date_cst = ?'
    ).get(date_cst) as { date_cst: string; goals: string | null; progress: string | null; open_questions: string | null; updated_at: string } | undefined;

    const items = db.prepare(
      'SELECT * FROM summary_items WHERE date_cst = ? ORDER BY position'
    ).all(date_cst);

    if (!row) {
      return res.json({
        date_cst,
        goals: null,
        progress: null,
        open_questions: null,
        updated_at: null,
        items,
      });
    }

    res.json({ ...row, items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch day summary' });
  }
});

// PUT /:date_cst — upsert template fields (goals, progress, open_questions)
router.put('/:date_cst', (req: Request, res: Response) => {
  try {
    const { date_cst } = req.params;
    const { goals, progress, open_questions } = req.body;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT date_cst FROM day_summaries WHERE date_cst = ?').get(date_cst);

    if (existing) {
      // Only update fields that are provided in the request body
      const updates: string[] = [];
      const params: unknown[] = [];

      if ('goals' in req.body) {
        updates.push('goals = ?');
        params.push(goals ?? null);
      }
      if ('progress' in req.body) {
        updates.push('progress = ?');
        params.push(progress ?? null);
      }
      if ('open_questions' in req.body) {
        updates.push('open_questions = ?');
        params.push(open_questions ?? null);
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        params.push(now, date_cst);
        db.prepare(`UPDATE day_summaries SET ${updates.join(', ')} WHERE date_cst = ?`).run(...params);
      }
    } else {
      db.prepare(
        'INSERT INTO day_summaries (date_cst, goals, progress, open_questions, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run(date_cst, goals ?? null, progress ?? null, open_questions ?? null, now);
    }

    const row = db.prepare(
      'SELECT date_cst, goals, progress, open_questions, updated_at FROM day_summaries WHERE date_cst = ?'
    ).get(date_cst);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save day summary' });
  }
});

// --- Summary Items ---

// GET /:date_cst/items — list items for a date, ordered by position
router.get('/:date_cst/items', (req: Request, res: Response) => {
  try {
    const items = db.prepare(
      'SELECT * FROM summary_items WHERE date_cst = ? ORDER BY position'
    ).all(req.params.date_cst);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch summary items' });
  }
});

// POST /:date_cst/items — create a summary item
router.post('/:date_cst/items', (req: Request, res: Response) => {
  try {
    const { date_cst } = req.params;
    const { title, content, tag } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    // Auto-assign position as max+1
    const maxRow = db.prepare(
      'SELECT MAX(position) as max_pos FROM summary_items WHERE date_cst = ?'
    ).get(date_cst) as { max_pos: number | null };
    const position = (maxRow.max_pos ?? -1) + 1;

    db.prepare(
      'INSERT INTO summary_items (id, date_cst, title, content, tag, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, date_cst, title.trim(), content ?? null, tag ?? null, position, now, now);

    const item = db.prepare('SELECT * FROM summary_items WHERE id = ?').get(id);
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create summary item' });
  }
});

// PUT /:date_cst/items/:id — update a summary item
router.put('/:date_cst/items/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, tag } = req.body;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM summary_items WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Summary item not found' });

    const updates: string[] = [];
    const params: unknown[] = [];

    if ('title' in req.body) {
      if (!title || !title.trim()) return res.status(400).json({ error: 'Title cannot be empty' });
      updates.push('title = ?');
      params.push(title.trim());
    }
    if ('content' in req.body) {
      updates.push('content = ?');
      params.push(content ?? null);
    }
    if ('tag' in req.body) {
      updates.push('tag = ?');
      params.push(tag ?? null);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now, id);
      db.prepare(`UPDATE summary_items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const item = db.prepare('SELECT * FROM summary_items WHERE id = ?').get(id);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update summary item' });
  }
});

// DELETE /:date_cst/items/:id — delete a summary item
router.delete('/:date_cst/items/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM summary_items WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Summary item not found' });

    db.prepare('DELETE FROM summary_items WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete summary item' });
  }
});

// PATCH /:date_cst/items/reorder — reorder items
router.patch('/:date_cst/items/reorder', (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array is required' });

    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE summary_items SET position = ?, updated_at = ? WHERE id = ?');
    const updateAll = db.transaction(() => {
      ids.forEach((id: string, index: number) => {
        stmt.run(index, now, id);
      });
    });
    updateAll();

    const items = db.prepare(
      'SELECT * FROM summary_items WHERE date_cst = ? ORDER BY position'
    ).all(req.params.date_cst);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder summary items' });
  }
});

export default router;
