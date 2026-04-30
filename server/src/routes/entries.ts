import { Router, Request, Response } from 'express';
import db from '../db';
import { getCSTDate } from '../services/fsrs';

const router = Router();

function parseEntry(row: Record<string, unknown>) {
  return {
    ...row,
    tags: JSON.parse(row.tags as string),
    links: JSON.parse(row.links as string),
    is_reviewable: Boolean(row.is_reviewable),
  };
}

router.get('/', (req: Request, res: Response) => {
  try {
    let query = 'SELECT * FROM entries';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (req.query.date_cst) {
      conditions.push("date(created_at, '-6 hours') = ?");
      params.push(req.query.date_cst);
    }
    if (req.query.start) {
      conditions.push("date(created_at, '-6 hours') >= ?");
      params.push(req.query.start);
    }
    if (req.query.end) {
      conditions.push("date(created_at, '-6 hours') <= ?");
      params.push(req.query.end);
    }
    if (req.query.tag) {
      conditions.push("tags LIKE ?");
      params.push(`%"${req.query.tag}"%`);
    }
    if (req.query.entry_type) {
      conditions.push("entry_type = ?");
      params.push(req.query.entry_type);
    }
    if (req.query.source) {
      conditions.push("source = ?");
      params.push(req.query.source);
    }
    if (req.query.is_reviewable !== undefined) {
      conditions.push("is_reviewable = ?");
      params.push(req.query.is_reviewable === 'true' ? 1 : 0);
    }
    if (req.query.status) {
      conditions.push("status = ?");
      params.push(req.query.status);
    }
    if (req.query.search) {
      conditions.push("content LIKE ?");
      params.push(`%${req.query.search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    const entries = rows.map(parseEntry);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ error: 'Entry not found' });

    const entry = parseEntry(row);

    // Check if this entry has been resolved
    const resolution = db.prepare(`
      SELECT r.id, r.resolution_entry_id, r.resolved_at,
             e.content as resolution_content, e.entry_type as resolution_entry_type,
             e.tags as resolution_tags, e.created_at as resolution_created_at
      FROM resolutions r
      JOIN entries e ON r.resolution_entry_id = e.id
      WHERE r.entry_id = ?
    `).get(req.params.id) as Record<string, unknown> | undefined;

    // Check if this entry IS a resolution for another entry
    const resolutionOf = db.prepare(`
      SELECT entry_id as resolved_entry_id FROM resolutions WHERE resolution_entry_id = ?
    `).get(req.params.id) as Record<string, unknown> | undefined;

    res.json({
      ...entry,
      resolution: resolution ? {
        ...resolution,
        resolution_tags: JSON.parse(resolution.resolution_tags as string),
      } : undefined,
      resolution_of: resolutionOf || undefined,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { content, tags, entry_type, source, links } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const type = entry_type || 'note';

    // Question entries default to open status with medium priority
    let status = req.body.status ?? null;
    let priority = req.body.priority ?? null;
    if (type === 'question' && status === null) {
      status = 'open';
    }
    if (type === 'question' && priority === null) {
      priority = 'medium';
    }

    db.prepare(`
      INSERT INTO entries (id, content, tags, entry_type, source, links, status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      content,
      JSON.stringify(tags || []),
      type,
      source || null,
      JSON.stringify(links || []),
      status,
      priority,
      now,
      now
    );

    const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json(parseEntry(entry));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM entries WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Entry not found' });

    const { content, tags, entry_type, source, links, status, priority } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE entries SET content = ?, tags = ?, entry_type = ?, source = ?, links = ?,
        status = ?, priority = ?, updated_at = ?
      WHERE id = ?
    `).run(
      content,
      JSON.stringify(tags || []),
      entry_type || 'note',
      source || null,
      JSON.stringify(links || []),
      status ?? null,
      priority ?? null,
      now,
      req.params.id
    );

    const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json(parseEntry(entry));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

router.post('/:id/promote', (req: Request, res: Response) => {
  try {
    const entry = db.prepare('SELECT id FROM entries WHERE id = ?').get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const { cards } = req.body;
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'Cards array is required' });
    }

    const now = new Date().toISOString();
    const today = getCSTDate();

    const insertCard = db.prepare(`
      INSERT INTO review_cards (id, entry_id, card_type, front, back, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const createdCards = [];
    for (const card of cards) {
      const cardId = crypto.randomUUID();
      insertCard.run(cardId, req.params.id, card.card_type || 'prompt_response', card.front, card.back, today, now, now);
      createdCards.push(db.prepare('SELECT * FROM review_cards WHERE id = ?').get(cardId));
    }

    db.prepare('UPDATE entries SET is_reviewable = 1, updated_at = ? WHERE id = ?').run(now, req.params.id);

    res.status(201).json(createdCards);
  } catch (error) {
    res.status(500).json({ error: 'Failed to promote entry' });
  }
});

router.delete('/:id/demote', (req: Request, res: Response) => {
  try {
    const entry = db.prepare('SELECT id FROM entries WHERE id = ?').get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    db.prepare('DELETE FROM review_cards WHERE entry_id = ?').run(req.params.id);
    const now = new Date().toISOString();
    db.prepare('UPDATE entries SET is_reviewable = 0, updated_at = ? WHERE id = ?').run(now, req.params.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to demote entry' });
  }
});

router.patch('/:id/priority', (req: Request, res: Response) => {
  try {
    const entry = db.prepare('SELECT id, status FROM entries WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const { priority } = req.body;
    if (!['high', 'medium', 'low'].includes(priority)) {
      return res.status(400).json({ error: 'Priority must be high, medium, or low' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE entries SET priority = ?, updated_at = ? WHERE id = ?').run(priority, now, req.params.id);

    const updated = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json(parseEntry(updated));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update priority' });
  }
});

router.post('/:id/resolve', (req: Request, res: Response) => {
  try {
    const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (entry.status !== 'open') return res.status(400).json({ error: 'Entry is not open' });

    const { content, tags, entry_type, source } = req.body;
    if (!content) return res.status(400).json({ error: 'Resolution content is required' });

    const now = new Date().toISOString();
    const resolutionEntryId = crypto.randomUUID();
    const resolutionId = crypto.randomUUID();

    const resolve = db.transaction(() => {
      // Create the resolution entry
      db.prepare(`
        INSERT INTO entries (id, content, tags, entry_type, source, links, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        resolutionEntryId,
        content,
        JSON.stringify(tags || JSON.parse(entry.tags as string)),
        entry_type || 'note',
        source || entry.source || null,
        JSON.stringify([]),
        now,
        now
      );

      // Create resolution record
      db.prepare(`
        INSERT INTO resolutions (id, entry_id, resolution_entry_id, resolved_at)
        VALUES (?, ?, ?, ?)
      `).run(resolutionId, req.params.id, resolutionEntryId, now);

      // Mark original entry as resolved
      db.prepare('UPDATE entries SET status = ?, updated_at = ? WHERE id = ?').run('resolved', now, req.params.id);
    });

    resolve();

    const updatedEntry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    const resolutionEntry = db.prepare('SELECT * FROM entries WHERE id = ?').get(resolutionEntryId) as Record<string, unknown>;

    res.status(201).json({
      entry: parseEntry(updatedEntry),
      resolution_entry: parseEntry(resolutionEntry),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve entry' });
  }
});

router.post('/:id/reopen', (req: Request, res: Response) => {
  try {
    const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (entry.status !== 'resolved') return res.status(400).json({ error: 'Entry is not resolved' });

    const now = new Date().toISOString();

    // Remove resolution record (keep the resolution entry in the log)
    db.prepare('DELETE FROM resolutions WHERE entry_id = ?').run(req.params.id);

    // Reopen the entry
    db.prepare('UPDATE entries SET status = ?, updated_at = ? WHERE id = ?').run('open', now, req.params.id);

    const updated = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json(parseEntry(updated));
  } catch (error) {
    res.status(500).json({ error: 'Failed to reopen entry' });
  }
});

export default router;
