import { Router, Request, Response } from 'express';
import db from '../db';
import { getCSTDate } from '../services/fsrs';

const router = Router();

const VALID_STATUSES = ['planned', 'active', 'completed', 'abandoned'];
const VALID_ITEM_STATUSES = ['todo', 'doing', 'done', 'skipped'];
const VALID_KINDS = ['reading', 'writing', 'code', 'task'];

interface MapRow {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  goal_original: string | null;
  status: string;
  status_reason: string | null;
  progress_pct: number | null;
  tags: string;
  due_date: string | null;
  position: number;
  completed_on: string | null;
  created_at: string;
  updated_at: string;
}

interface MapItemRow {
  id: string;
  map_id: string;
  kind: string;
  title: string;
  notes: string | null;
  item_status: string;
  link: string | null;
  entry_id: string | null;
  task_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

interface LooseLink {
  app: string;
  ref_type: string;
  ref_id: string;
  label?: string;
}

function parseMap(row: MapRow) {
  return { ...row, tags: JSON.parse(row.tags) as string[] };
}

function parseItem(row: MapItemRow) {
  return { ...row, link: row.link ? (JSON.parse(row.link) as LooseLink) : null };
}

// Per-map { total, done } counts. Display only — never written back to progress_pct.
function getCounts(mapId: string): { total: number; done: number } {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN item_status = 'done' THEN 1 ELSE 0 END) AS done
       FROM map_items WHERE map_id = ?`
    )
    .get(mapId) as { total: number; done: number | null };
  return { total: row.total, done: row.done ?? 0 };
}

function loadMap(id: string) {
  const row = db.prepare('SELECT * FROM maps WHERE id = ?').get(id) as MapRow | undefined;
  if (!row) return null;
  const items = (
    db
      .prepare('SELECT * FROM map_items WHERE map_id = ? ORDER BY position ASC, created_at ASC')
      .all(id) as MapItemRow[]
  ).map(parseItem);
  return { ...parseMap(row), items, item_counts: getCounts(id) };
}

// Returns an error message if invalid, otherwise null.
function validateLink(link: unknown): string | null {
  if (typeof link !== 'object' || link === null || Array.isArray(link)) {
    return 'link must be an object';
  }
  const l = link as Record<string, unknown>;
  if (typeof l.app !== 'string' || !l.app.trim()) return 'link.app must be a string';
  if (typeof l.ref_type !== 'string' || !l.ref_type.trim()) return 'link.ref_type must be a string';
  if (typeof l.ref_id !== 'string' || !l.ref_id.trim()) return 'link.ref_id must be a string';
  if (l.label !== undefined && l.label !== null && typeof l.label !== 'string') {
    return 'link.label must be a string';
  }
  return null;
}

// -------------------------------------------------------------------------
// PATCH /reorder — maps-level reorder. MUST precede /:id routes.
// -------------------------------------------------------------------------
router.patch('/reorder', (req: Request, res: Response) => {
  try {
    const { ordered_ids } = req.body;
    if (!Array.isArray(ordered_ids)) {
      return res.status(400).json({ error: 'ordered_ids array is required' });
    }
    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE maps SET position = ?, updated_at = ? WHERE id = ?');
    const reorder = db.transaction(() => {
      ordered_ids.forEach((id: string, index: number) => stmt.run(index, now, id));
    });
    reorder();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder maps' });
  }
});

// -------------------------------------------------------------------------
// GET / — list with optional status / tag / search filters.
// -------------------------------------------------------------------------
router.get('/', (req: Request, res: Response) => {
  try {
    const where: string[] = [];
    const params: unknown[] = [];

    if (req.query.status) {
      const status = String(req.query.status);
      if (!VALID_STATUSES.includes(status)) return res.json([]);
      where.push('status = ?');
      params.push(status);
    }
    if (req.query.tag) {
      where.push('tags LIKE ?');
      params.push(`%"${req.query.tag}"%`);
    }
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search) {
      where.push('(title LIKE ? OR description LIKE ? OR goal LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const sql =
      `SELECT * FROM maps` +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ` ORDER BY position ASC, created_at DESC`;
    const rows = db.prepare(sql).all(...params) as MapRow[];

    // One GROUP BY query for per-map counts (display only).
    const countRows = db
      .prepare(
        `SELECT map_id,
                COUNT(*) AS total,
                SUM(CASE WHEN item_status = 'done' THEN 1 ELSE 0 END) AS done
         FROM map_items GROUP BY map_id`
      )
      .all() as { map_id: string; total: number; done: number | null }[];
    const countMap = new Map(countRows.map(r => [r.map_id, { total: r.total, done: r.done ?? 0 }]));

    const maps = rows.map(row => ({
      ...parseMap(row),
      item_counts: countMap.get(row.id) ?? { total: 0, done: 0 },
    }));
    res.json(maps);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch maps' });
  }
});

// -------------------------------------------------------------------------
// POST / — create a map, optionally with embedded items (single transaction).
// -------------------------------------------------------------------------
router.post('/', (req: Request, res: Response) => {
  try {
    const { title, description, goal, tags, due_date, items } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (items !== undefined && !Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an array' });
    }
    // Validate all embedded items up-front so the transaction never partially fails.
    if (Array.isArray(items)) {
      for (const it of items) {
        if (!it || typeof it !== 'object') {
          return res.status(400).json({ error: 'Each item must be an object' });
        }
        if (!VALID_KINDS.includes(it.kind)) {
          return res.status(400).json({ error: 'Invalid item kind' });
        }
        if (!it.title || typeof it.title !== 'string' || !it.title.trim()) {
          return res.status(400).json({ error: 'Each item requires a title' });
        }
        if (it.item_status !== undefined && it.item_status !== null && !VALID_ITEM_STATUSES.includes(it.item_status)) {
          return res.status(400).json({ error: 'Invalid item_status' });
        }
        if (it.link !== undefined && it.link !== null) {
          const err = validateLink(it.link);
          if (err) return res.status(400).json({ error: err });
        }
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const goalVal = goal === undefined || goal === null ? null : String(goal);
    // Write-once: seed goal_original whenever a non-empty goal is set at creation.
    const goalOriginal = goalVal && goalVal.length > 0 ? goalVal : null;
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
    const dueDate = typeof due_date === 'string' && due_date.trim() ? due_date : null;

    const maxRow = db.prepare('SELECT MAX(position) AS max_pos FROM maps').get() as { max_pos: number | null };
    const position = (maxRow.max_pos ?? -1) + 1;

    const insertMap = db.prepare(
      `INSERT INTO maps (id, title, description, goal, goal_original, status, status_reason,
                         progress_pct, tags, due_date, position, completed_on, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'planned', NULL, NULL, ?, ?, ?, NULL, ?, ?)`
    );
    const insertItem = db.prepare(
      `INSERT INTO map_items (id, map_id, kind, title, notes, item_status, link, entry_id, task_id, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const create = db.transaction(() => {
      insertMap.run(id, title.trim(), description ?? null, goalVal, goalOriginal, tagsJson, dueDate, position, now, now);
      if (Array.isArray(items)) {
        items.forEach((it: Record<string, unknown>, idx: number) => {
          const itemId = crypto.randomUUID();
          const itemPos =
            typeof it.position === 'number' && Number.isFinite(it.position) ? (it.position as number) : idx;
          const itemStatus =
            typeof it.item_status === 'string' && VALID_ITEM_STATUSES.includes(it.item_status)
              ? it.item_status
              : 'todo';
          const linkJson = it.link !== undefined && it.link !== null ? JSON.stringify(it.link) : null;
          insertItem.run(
            itemId,
            id,
            it.kind,
            String(it.title).trim(),
            (it.notes as string | undefined) ?? null,
            itemStatus,
            linkJson,
            (it.entry_id as string | undefined) ?? null,
            (it.task_id as string | undefined) ?? null,
            itemPos,
            now,
            now
          );
        });
      }
    });
    create();

    res.status(201).json(loadMap(id));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create map' });
  }
});

// -------------------------------------------------------------------------
// GET /:id/resolve-links — best-effort liveness of each linked item.
// MUST precede GET /:id (distinct suffix, but keep it explicit).
// -------------------------------------------------------------------------
type LiveStatus = 'ok' | 'missing' | 'unreachable';

async function fetchWithTimeout(url: string, ms = 1500): Promise<globalThis.Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function checkLink(link: LooseLink): Promise<LiveStatus> {
  const app = String(link.app || '').toLowerCase();
  const refType = String(link.ref_type || '');
  const refId = String(link.ref_id || '');
  try {
    if (app === 'granary') {
      const table = refType === 'entry' ? 'entries' : refType === 'document' ? 'documents' : refType === 'map' ? 'maps' : null;
      if (!table) return 'missing';
      const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(refId);
      return row ? 'ok' : 'missing';
    }
    if (app === 'navigate') {
      const resp = await fetchWithTimeout('http://localhost:3001/api/papers');
      if (!resp || !resp.ok) return 'unreachable';
      const data = await resp.json().catch(() => null);
      const papers = Array.isArray(data) ? data : Array.isArray((data as any)?.papers) ? (data as any).papers : [];
      const found = papers.some((p: any) => p && (p.arxiv_id === refId || p.arxivId === refId));
      return found ? 'ok' : 'missing';
    }
    if (app === 'scribe') {
      if (refType === 'flowchart_node') {
        const [flowchartId, nodeKey] = refId.split(':');
        if (!flowchartId || !nodeKey) return 'missing';
        const resp = await fetchWithTimeout(
          `http://localhost:3003/api/flowcharts/nodes/${encodeURIComponent(flowchartId)}/${encodeURIComponent(nodeKey)}`
        );
        if (!resp) return 'unreachable';
        if (resp.status === 404) return 'missing';
        return resp.ok ? 'ok' : 'missing';
      }
      const resp = await fetchWithTimeout(`http://localhost:3003/api/notes/${encodeURIComponent(refId)}`);
      if (!resp) return 'unreachable';
      if (resp.status === 404) return 'missing';
      return resp.ok ? 'ok' : 'missing';
    }
    if (app === 'monolith') {
      const resp = await fetchWithTimeout('http://localhost:3005/api/projects');
      if (!resp || !resp.ok) return 'unreachable';
      const data = await resp.json().catch(() => null);
      const projects = Array.isArray(data) ? data : Array.isArray((data as any)?.projects) ? (data as any).projects : [];
      const projectName = refType === 'file' ? refId.split('/')[0] : refId;
      const found = projects.some((p: any) =>
        typeof p === 'string' ? p === projectName : p && (p.name === projectName || p.id === projectName || p.dir === projectName)
      );
      return found ? 'ok' : 'missing';
    }
    if (app === 'pyramid') {
      const resp = await fetchWithTimeout(`http://localhost:3007/api/sessions/${encodeURIComponent(refId)}`);
      if (!resp) return 'unreachable';
      if (resp.status === 404) return 'missing';
      return resp.ok ? 'ok' : 'missing';
    }
    return 'unreachable';
  } catch {
    return 'unreachable';
  }
}

router.get('/:id/resolve-links', async (req: Request, res: Response) => {
  try {
    const map = db.prepare('SELECT id FROM maps WHERE id = ?').get(req.params.id);
    if (!map) return res.status(404).json({ error: 'Map not found' });

    const items = db
      .prepare('SELECT id, link FROM map_items WHERE map_id = ? AND link IS NOT NULL')
      .all(req.params.id) as { id: string; link: string }[];

    const results = await Promise.all(
      items.map(async (it): Promise<{ item_id: string; status: LiveStatus }> => {
        let link: LooseLink | null = null;
        try {
          link = JSON.parse(it.link) as LooseLink;
        } catch {
          link = null;
        }
        if (!link || typeof link !== 'object') return { item_id: it.id, status: 'missing' };
        return { item_id: it.id, status: await checkLink(link) };
      })
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve links' });
  }
});

// -------------------------------------------------------------------------
// GET /:id — single map with items + counts.
// -------------------------------------------------------------------------
router.get('/:id', (req: Request, res: Response) => {
  try {
    const map = loadMap(String(req.params.id));
    if (!map) return res.status(404).json({ error: 'Map not found' });
    res.json(map);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch map' });
  }
});

// -------------------------------------------------------------------------
// PATCH /:id — partial update of a map.
// -------------------------------------------------------------------------
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM maps WHERE id = ?').get(req.params.id) as MapRow | undefined;
    if (!existing) return res.status(404).json({ error: 'Map not found' });

    const body = req.body as Record<string, unknown>;
    const updates: string[] = [];
    const params: unknown[] = [];

    if ('title' in body) {
      const title = body.title;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      updates.push('title = ?');
      params.push(title.trim());
    }
    if ('description' in body) {
      updates.push('description = ?');
      params.push((body.description as string | null) ?? null);
    }
    if ('goal' in body) {
      const goalVal = body.goal === undefined || body.goal === null ? null : String(body.goal);
      updates.push('goal = ?');
      params.push(goalVal);
      // Write-once: seed goal_original on the first non-empty goal ever written.
      if (existing.goal_original == null && goalVal && goalVal.length > 0) {
        updates.push('goal_original = ?');
        params.push(goalVal);
      }
    }
    if ('status' in body) {
      const status = body.status;
      if (typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updates.push('status = ?');
      params.push(status);
      if (status === 'completed' && existing.status !== 'completed') {
        updates.push('completed_on = ?');
        params.push(getCSTDate());
      } else if (status !== 'completed' && existing.status === 'completed') {
        updates.push('completed_on = ?');
        params.push(null);
      }
    }
    if ('status_reason' in body) {
      updates.push('status_reason = ?');
      params.push((body.status_reason as string | null) ?? null);
    }
    if ('progress_pct' in body) {
      const pct = body.progress_pct;
      if (pct !== null && (!Number.isInteger(pct) || (pct as number) < 0 || (pct as number) > 100)) {
        return res.status(400).json({ error: 'progress_pct must be an integer 0-100 or null' });
      }
      updates.push('progress_pct = ?');
      params.push(pct ?? null);
    }
    if ('tags' in body) {
      updates.push('tags = ?');
      params.push(JSON.stringify(Array.isArray(body.tags) ? body.tags : []));
    }
    if ('due_date' in body) {
      const dueDate = typeof body.due_date === 'string' && body.due_date.trim() ? body.due_date : null;
      updates.push('due_date = ?');
      params.push(dueDate);
    }
    if ('position' in body) {
      const position = body.position;
      if (typeof position !== 'number' || !Number.isFinite(position)) {
        return res.status(400).json({ error: 'position must be a number' });
      }
      updates.push('position = ?');
      params.push(position);
    }

    if (updates.length > 0) {
      const now = new Date().toISOString();
      updates.push('updated_at = ?');
      params.push(now, req.params.id);
      db.prepare(`UPDATE maps SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    res.json(loadMap(String(req.params.id)));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update map' });
  }
});

// -------------------------------------------------------------------------
// DELETE /:id — cascades to map_items via FK.
// -------------------------------------------------------------------------
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM maps WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Map not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete map' });
  }
});

// -------------------------------------------------------------------------
// PATCH /:id/items/reorder — MUST precede /:id/items/:itemId.
// -------------------------------------------------------------------------
router.patch('/:id/items/reorder', (req: Request, res: Response) => {
  try {
    const { ordered_ids } = req.body;
    if (!Array.isArray(ordered_ids)) {
      return res.status(400).json({ error: 'ordered_ids array is required' });
    }
    const map = db.prepare('SELECT id FROM maps WHERE id = ?').get(req.params.id);
    if (!map) return res.status(404).json({ error: 'Map not found' });

    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE map_items SET position = ?, updated_at = ? WHERE id = ? AND map_id = ?');
    const reorder = db.transaction(() => {
      ordered_ids.forEach((id: string, index: number) => stmt.run(index, now, id, req.params.id));
    });
    reorder();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

// -------------------------------------------------------------------------
// POST /:id/items — add an item to a map.
// -------------------------------------------------------------------------
router.post('/:id/items', (req: Request, res: Response) => {
  try {
    const map = db.prepare('SELECT id FROM maps WHERE id = ?').get(req.params.id);
    if (!map) return res.status(404).json({ error: 'Map not found' });

    const { kind, title, notes, link, entry_id, task_id, position } = req.body;
    if (!VALID_KINDS.includes(kind)) return res.status(400).json({ error: 'Invalid item kind' });
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (link !== undefined && link !== null) {
      const err = validateLink(link);
      if (err) return res.status(400).json({ error: err });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    let itemPos: number;
    if (typeof position === 'number' && Number.isFinite(position)) {
      itemPos = position;
    } else {
      const maxRow = db
        .prepare('SELECT MAX(position) AS max_pos FROM map_items WHERE map_id = ?')
        .get(req.params.id) as { max_pos: number | null };
      itemPos = (maxRow.max_pos ?? -1) + 1;
    }
    const linkJson = link !== undefined && link !== null ? JSON.stringify(link) : null;

    db.prepare(
      `INSERT INTO map_items (id, map_id, kind, title, notes, item_status, link, entry_id, task_id, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?)`
    ).run(id, req.params.id, kind, title.trim(), notes ?? null, linkJson, entry_id ?? null, task_id ?? null, itemPos, now, now);

    const row = db.prepare('SELECT * FROM map_items WHERE id = ?').get(id) as MapItemRow;
    res.status(201).json(parseItem(row));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create map item' });
  }
});

// -------------------------------------------------------------------------
// PATCH /:id/items/:itemId — partial update of an item.
// -------------------------------------------------------------------------
router.patch('/:id/items/:itemId', (req: Request, res: Response) => {
  try {
    const existing = db
      .prepare('SELECT id FROM map_items WHERE id = ? AND map_id = ?')
      .get(req.params.itemId, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Map item not found' });

    const body = req.body as Record<string, unknown>;
    const updates: string[] = [];
    const params: unknown[] = [];

    if ('kind' in body) {
      if (typeof body.kind !== 'string' || !VALID_KINDS.includes(body.kind)) {
        return res.status(400).json({ error: 'Invalid item kind' });
      }
      updates.push('kind = ?');
      params.push(body.kind);
    }
    if ('title' in body) {
      const title = body.title;
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      updates.push('title = ?');
      params.push(title.trim());
    }
    if ('notes' in body) {
      updates.push('notes = ?');
      params.push((body.notes as string | null) ?? null);
    }
    if ('item_status' in body) {
      if (typeof body.item_status !== 'string' || !VALID_ITEM_STATUSES.includes(body.item_status)) {
        return res.status(400).json({ error: 'Invalid item_status' });
      }
      updates.push('item_status = ?');
      params.push(body.item_status);
    }
    if ('link' in body) {
      if (body.link === null) {
        updates.push('link = ?');
        params.push(null);
      } else {
        const err = validateLink(body.link);
        if (err) return res.status(400).json({ error: err });
        updates.push('link = ?');
        params.push(JSON.stringify(body.link));
      }
    }
    if ('entry_id' in body) {
      updates.push('entry_id = ?');
      params.push((body.entry_id as string | null) ?? null);
    }
    if ('task_id' in body) {
      updates.push('task_id = ?');
      params.push((body.task_id as string | null) ?? null);
    }
    if ('position' in body) {
      const position = body.position;
      if (typeof position !== 'number' || !Number.isFinite(position)) {
        return res.status(400).json({ error: 'position must be a number' });
      }
      updates.push('position = ?');
      params.push(position);
    }

    if (updates.length > 0) {
      const now = new Date().toISOString();
      updates.push('updated_at = ?');
      params.push(now, req.params.itemId);
      db.prepare(`UPDATE map_items SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const row = db.prepare('SELECT * FROM map_items WHERE id = ?').get(req.params.itemId) as MapItemRow;
    res.json(parseItem(row));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update map item' });
  }
});

// -------------------------------------------------------------------------
// DELETE /:id/items/:itemId
// -------------------------------------------------------------------------
router.delete('/:id/items/:itemId', (req: Request, res: Response) => {
  try {
    const result = db
      .prepare('DELETE FROM map_items WHERE id = ? AND map_id = ?')
      .run(req.params.itemId, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Map item not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete map item' });
  }
});

export default router;
