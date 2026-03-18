import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    let query = 'SELECT * FROM entries WHERE status = ?';
    const params: unknown[] = [];

    const includeResolved = req.query.include_resolved === 'true';
    if (includeResolved) {
      query = "SELECT * FROM entries WHERE status IN ('open', 'resolved')";
    } else {
      params.push('open');
    }

    if (req.query.entry_type) {
      query += ' AND entry_type = ?';
      params.push(req.query.entry_type);
    }
    if (req.query.tag) {
      query += ' AND tags LIKE ?';
      params.push(`%"${req.query.tag}"%`);
    }
    if (req.query.source) {
      query += ' AND source = ?';
      params.push(req.query.source);
    }
    if (req.query.priority) {
      query += ' AND priority = ?';
      params.push(req.query.priority);
    }

    query += ` ORDER BY
      CASE status WHEN 'open' THEN 0 WHEN 'resolved' THEN 1 END,
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
      created_at ASC`;

    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];

    // For resolved entries, attach resolution data
    const getResolution = db.prepare(`
      SELECT r.id, r.resolution_entry_id, r.resolved_at,
             e.content as resolution_content, e.entry_type as resolution_entry_type,
             e.tags as resolution_tags
      FROM resolutions r
      JOIN entries e ON r.resolution_entry_id = e.id
      WHERE r.entry_id = ?
    `);

    const entries = rows.map(row => {
      const entry = {
        ...row,
        tags: JSON.parse(row.tags as string),
        links: JSON.parse(row.links as string),
        is_reviewable: Boolean(row.is_reviewable),
      };

      if (includeResolved && row.status === 'resolved') {
        const resolution = getResolution.get(row.id) as Record<string, unknown> | undefined;
        if (resolution) {
          return {
            ...entry,
            resolution: {
              ...resolution,
              resolution_tags: JSON.parse(resolution.resolution_tags as string),
            },
          };
        }
      }

      return entry;
    });

    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch open entries' });
  }
});

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const total = (db.prepare("SELECT COUNT(*) as count FROM entries WHERE status = 'open'").get() as { count: number }).count;

    const byPriority = db.prepare(
      "SELECT priority, COUNT(*) as count FROM entries WHERE status = 'open' GROUP BY priority"
    ).all() as { priority: string; count: number }[];

    const byEntryType = db.prepare(
      "SELECT entry_type, COUNT(*) as count FROM entries WHERE status = 'open' GROUP BY entry_type"
    ).all() as { entry_type: string; count: number }[];

    const byTag = db.prepare(
      "SELECT j.value as tag, COUNT(*) as count FROM entries, json_each(entries.tags) j WHERE entries.status = 'open' GROUP BY j.value"
    ).all() as { tag: string; count: number }[];

    res.json({ total, by_priority: byPriority, by_entry_type: byEntryType, by_tag: byTag });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch open items stats' });
  }
});

export default router;
