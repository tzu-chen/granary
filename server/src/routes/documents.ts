import { Router, Request, Response } from 'express';
import multer from 'multer';
import db from '../db';
import { derivePersistedFields } from '../services/documentParser';
import { deriveTitle, sanitizeFilename } from '../services/documentImporter';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

interface DocumentRow {
  id: string;
  title: string;
  content: string;
  tags: string;
  source: string | null;
  links: string;
  open_todo_count: number;
  total_todo_count: number;
  imported_from: string | null;
  created_at: string;
  updated_at: string;
}

function parseDocument(row: DocumentRow) {
  return {
    ...row,
    tags: JSON.parse(row.tags),
    links: JSON.parse(row.links),
  };
}

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const total = (db.prepare('SELECT COUNT(*) as c FROM documents').get() as { c: number }).c;
    const withOpenTodos = (db.prepare('SELECT COUNT(*) as c FROM documents WHERE open_todo_count > 0').get() as { c: number }).c;
    const totalBytes = (db.prepare('SELECT COALESCE(SUM(LENGTH(content)), 0) as b FROM documents').get() as { b: number }).b;

    const rows = db.prepare('SELECT tags FROM documents').all() as { tags: string }[];
    const tagCounts: Record<string, number> = {};
    for (const row of rows) {
      const tags: string[] = JSON.parse(row.tags);
      for (const tag of tags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
    const byTag = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ total, with_open_todos: withOpenTodos, total_bytes: totalBytes, by_tag: byTag });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document stats' });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const params: unknown[] = [];
    const conditions: string[] = [];
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    let query: string;
    if (search) {
      query = `
        SELECT d.*, bm25(documents_fts) as rank, snippet(documents_fts, 1, '<mark>', '</mark>', '…', 24) as snippet
        FROM documents d
        JOIN documents_fts ON documents_fts.rowid = d.rowid
        WHERE documents_fts MATCH ?
      `;
      params.push(escapeFts(search));
    } else {
      query = 'SELECT d.* FROM documents d';
    }

    if (req.query.tag) {
      conditions.push("d.tags LIKE ?");
      params.push(`%"${req.query.tag}"%`);
    }
    if (req.query.source) {
      conditions.push("d.source = ?");
      params.push(req.query.source);
    }
    if (req.query.start) {
      conditions.push("date(d.updated_at, '-6 hours') >= ?");
      params.push(req.query.start);
    }
    if (req.query.end) {
      conditions.push("date(d.updated_at, '-6 hours') <= ?");
      params.push(req.query.end);
    }
    if (req.query.has_open_todos === 'true') {
      conditions.push("d.open_todo_count > 0");
    } else if (req.query.has_open_todos === 'false') {
      conditions.push("d.open_todo_count = 0");
    }

    if (conditions.length > 0) {
      query += (search ? ' AND ' : ' WHERE ') + conditions.join(' AND ');
    }
    query += search ? ' ORDER BY rank' : ' ORDER BY d.updated_at DESC';

    const rows = db.prepare(query).all(...params) as (DocumentRow & { snippet?: string })[];
    const documents = rows.map(row => {
      const parsed = parseDocument(row);
      if (row.snippet) (parsed as Record<string, unknown>).snippet = row.snippet;
      return parsed;
    });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) as DocumentRow | undefined;
    if (!row) return res.status(404).json({ error: 'Document not found' });
    res.json(parseDocument(row));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { title, content, tags, source } = req.body;
    if (!title || typeof title !== 'string') return res.status(400).json({ error: 'Title is required' });
    if (typeof content !== 'string') return res.status(400).json({ error: 'Content is required' });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const derived = derivePersistedFields(content);

    db.prepare(`
      INSERT INTO documents (id, title, content, tags, source, links, open_todo_count, total_todo_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      content,
      JSON.stringify(tags || []),
      source || null,
      JSON.stringify(derived.links),
      derived.open_todo_count,
      derived.total_todo_count,
      now,
      now
    );

    const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow;
    res.status(201).json(parseDocument(row));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create document' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Document not found' });

    const { title, content, tags, source } = req.body;
    if (!title || typeof title !== 'string') return res.status(400).json({ error: 'Title is required' });
    if (typeof content !== 'string') return res.status(400).json({ error: 'Content is required' });

    const now = new Date().toISOString();
    const derived = derivePersistedFields(content);

    db.prepare(`
      UPDATE documents SET title = ?, content = ?, tags = ?, source = ?, links = ?,
        open_todo_count = ?, total_todo_count = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title,
      content,
      JSON.stringify(tags || []),
      source || null,
      JSON.stringify(derived.links),
      derived.open_todo_count,
      derived.total_todo_count,
      now,
      req.params.id
    );

    const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) as DocumentRow;
    res.json(parseDocument(row));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update document' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Document not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

router.post('/import', upload.array('files'), (req: Request, res: Response) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    const created: Record<string, unknown>[] = [];
    const now = new Date().toISOString();

    const insert = db.prepare(`
      INSERT INTO documents (id, title, content, tags, source, links, open_todo_count, total_todo_count, imported_from, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    if (files.length === 0) {
      // Paste mode: expect JSON body { title, content, tags?, source? }
      const { title, content, tags, source } = req.body || {};
      if (!title || typeof title !== 'string') return res.status(400).json({ error: 'Title is required for paste mode' });
      if (typeof content !== 'string') return res.status(400).json({ error: 'Content is required for paste mode' });

      const id = crypto.randomUUID();
      const derived = derivePersistedFields(content);
      insert.run(
        id,
        title,
        content,
        JSON.stringify(tags || []),
        source || null,
        JSON.stringify(derived.links),
        derived.open_todo_count,
        derived.total_todo_count,
        null,
        now,
        now
      );
      const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow;
      created.push(parseDocument(row));
    } else {
      // File mode: 1+ files. Optional `titles` field (JSON array) to override per-file titles.
      let titleOverrides: (string | null)[] = [];
      if (req.body?.titles) {
        try { titleOverrides = JSON.parse(req.body.titles); } catch { titleOverrides = []; }
      }
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const text = file.buffer.toString('utf-8');
        const title = (titleOverrides[i] && typeof titleOverrides[i] === 'string')
          ? (titleOverrides[i] as string)
          : deriveTitle(file.originalname, text);
        const id = crypto.randomUUID();
        const derived = derivePersistedFields(text);
        insert.run(
          id,
          title,
          text,
          JSON.stringify([]),
          null,
          JSON.stringify(derived.links),
          derived.open_todo_count,
          derived.total_todo_count,
          file.originalname,
          now,
          now
        );
        const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as DocumentRow;
        created.push(parseDocument(row));
      }
    }

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: 'Failed to import documents' });
  }
});

router.get('/:id/export', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT title, content FROM documents WHERE id = ?').get(req.params.id) as { title: string; content: string } | undefined;
    if (!row) return res.status(404).json({ error: 'Document not found' });

    const filename = `${sanitizeFilename(row.title)}.md`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(row.content);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export document' });
  }
});

function escapeFts(query: string): string {
  // FTS5 token-safe: split on whitespace, drop punctuation, quote each token.
  // Result is implicitly AND-joined.
  const tokens = query
    .split(/\s+/)
    .map(t => t.replace(/[^\p{L}\p{N}_-]+/gu, ''))
    .filter(t => t.length > 0);
  if (tokens.length === 0) return '""';
  return tokens.map(t => `"${t}"`).join(' ');
}

export default router;
