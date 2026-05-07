import { Router, Request, Response } from 'express';
import db from '../db';
import { getCSTDate } from '../services/fsrs';

const router = Router();

const ACTIVE_STATES = ['planned', 'in_progress', 'blocked'];
const VALID_STATES = ['planned', 'in_progress', 'done', 'abandoned', 'blocked'];

// PATCH /reorder — must come before /:id routes
router.patch('/reorder', (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array is required' });

    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?');
    const updateAll = db.transaction(() => {
      ids.forEach((id: string, index: number) => {
        stmt.run(index, now, id);
      });
    });
    updateAll();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder tasks' });
  }
});

// GET /active — convenience for active tasks
router.get('/active', (_req: Request, res: Response) => {
  try {
    const placeholders = ACTIVE_STATES.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT * FROM tasks WHERE state IN (${placeholders}) ORDER BY position ASC, created_at ASC`
    ).all(...ACTIVE_STATES);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active tasks' });
  }
});

// GET /by-day/:date_cst — union of (active && created_on <= date) and (completed_on = date)
router.get('/by-day/:date_cst', (req: Request, res: Response) => {
  try {
    const { date_cst } = req.params;
    const placeholders = ACTIVE_STATES.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT * FROM tasks
       WHERE (state IN (${placeholders}) AND created_on <= ?)
          OR (completed_on = ?)
       ORDER BY position ASC, created_at ASC`
    ).all(...ACTIVE_STATES, date_cst, date_cst);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks for day' });
  }
});

// GET / — list with filters
router.get('/', (req: Request, res: Response) => {
  try {
    const { state, created_on, completed_on, since, until } = req.query;

    const where: string[] = [];
    const params: unknown[] = [];

    if (state) {
      const states = String(state).split(',').filter(s => VALID_STATES.includes(s));
      if (states.length === 0) return res.json([]);
      where.push(`state IN (${states.map(() => '?').join(',')})`);
      params.push(...states);
    } else {
      where.push(`state IN (${ACTIVE_STATES.map(() => '?').join(',')})`);
      params.push(...ACTIVE_STATES);
    }

    if (created_on) { where.push('created_on = ?'); params.push(created_on); }
    if (completed_on) { where.push('completed_on = ?'); params.push(completed_on); }
    if (since) { where.push('created_on >= ?'); params.push(since); }
    if (until) { where.push('created_on <= ?'); params.push(until); }

    const sql = `SELECT * FROM tasks WHERE ${where.join(' AND ')} ORDER BY position ASC, created_at ASC`;
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /:id — single task
router.get('/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Task not found' });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// POST / — create
router.post('/', (req: Request, res: Response) => {
  try {
    const { title, notes, state } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const taskState = state && VALID_STATES.includes(state) ? state : 'planned';

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const today = getCSTDate();

    const maxRow = db.prepare(
      `SELECT MAX(position) as max_pos FROM tasks WHERE state IN (${ACTIVE_STATES.map(() => '?').join(',')})`
    ).get(...ACTIVE_STATES) as { max_pos: number | null };
    const position = (maxRow.max_pos ?? -1) + 1;

    const completedOn = (taskState === 'done' || taskState === 'abandoned') ? today : null;

    db.prepare(
      `INSERT INTO tasks (id, title, notes, state, state_reason, created_on, completed_on, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`
    ).run(id, String(title).trim(), notes ?? null, taskState, today, completedOn, position, now, now);

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.status(201).json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /:id — update title and/or notes
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, notes } = req.body;

    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const updates: string[] = [];
    const params: unknown[] = [];

    if ('title' in req.body) {
      if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title cannot be empty' });
      updates.push('title = ?');
      params.push(String(title).trim());
    }
    if ('notes' in req.body) {
      updates.push('notes = ?');
      params.push(notes ?? null);
    }

    if (updates.length > 0) {
      const now = new Date().toISOString();
      updates.push('updated_at = ?');
      params.push(now, id);
      db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// PATCH /:id/state — state transition
router.patch('/:id/state', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { state, reason } = req.body;
    if (!state || !VALID_STATES.includes(state)) {
      return res.status(400).json({ error: 'Valid state is required' });
    }

    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const now = new Date().toISOString();
    const today = getCSTDate();
    const isTerminal = state === 'done' || state === 'abandoned';
    const completedOn = isTerminal ? today : null;
    const stateReason = reason && String(reason).trim() ? String(reason).trim() : null;

    db.prepare(
      `UPDATE tasks SET state = ?, state_reason = ?, completed_on = ?, updated_at = ? WHERE id = ?`
    ).run(state, stateReason, completedOn, now, id);

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task state' });
  }
});

// DELETE /:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
