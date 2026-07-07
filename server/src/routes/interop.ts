import { Router, Request, Response } from 'express';
import db from '../db';

// Cross-app autocomplete + base-URL resolution for the map link picker.
// Granary proxies searches to sibling apps server-side (same pattern as the
// scribe books proxy) so the browser never has to talk to them directly and a
// down sibling degrades gracefully to an empty list.

const router = Router();

interface Suggestion {
  app: string;
  ref_type: string;
  ref_id: string;
  label: string;
  subtitle?: string;
}

// Production default ports (each sibling serves its own SPA + API here).
const DEFAULT_BASE: Record<string, string> = {
  navigate: 'http://localhost:3001',
  scribe: 'http://localhost:3003',
  monolith: 'http://localhost:3005',
  pyramid: 'http://localhost:3007',
};

// Overridable per app via a `<app>_url` setting (mirrors the existing scribe_url).
function baseUrl(app: string): string | null {
  const def = DEFAULT_BASE[app];
  if (!def) return null;
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(`${app}_url`) as { value: string } | undefined;
  return (row?.value || def).replace(/\/+$/, '');
}

async function fetchWithTimeout(url: string, ms = 2000): Promise<globalThis.Response | null> {
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

// Tiny TTL cache so repeated keystrokes don't hammer sibling list endpoints.
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL_MS = 60_000;

async function fetchJsonCached(url: string): Promise<unknown> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data;
  const resp = await fetchWithTimeout(url);
  if (!resp || !resp.ok) return null;
  const data = await resp.json().catch(() => null);
  cache.set(url, { data, ts: Date.now() });
  return data;
}

// Sibling list endpoints return either a bare array or an object like { papers: [...] }.
function asArray(data: unknown, key: string): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as any)[key])) return (data as any)[key];
  return [];
}

function includesCI(hay: unknown, q: string): boolean {
  return String(hay ?? '').toLowerCase().includes(q);
}

function firstLine(content: string): string {
  const line = String(content || '').split('\n').find(l => l.trim()) || '';
  const stripped = line.replace(/[#*`>_]/g, '').trim();
  if (!stripped) return '(untitled entry)';
  return stripped.length > 70 ? `${stripped.slice(0, 70)}…` : stripped;
}

async function searchRecords(app: string, refType: string, raw: string): Promise<Suggestion[]> {
  const q = raw.trim().toLowerCase();
  const like = `%${raw.trim()}%`;
  const mk = (ref_id: string, label: string, subtitle?: string): Suggestion => ({ app, ref_type: refType, ref_id, label, subtitle });

  // -- Granary self-references: query the local DB directly --
  if (app === 'granary') {
    if (refType === 'entry') {
      const rows = raw.trim()
        ? db.prepare('SELECT id, content, source FROM entries WHERE content LIKE ? ORDER BY created_at DESC LIMIT 12').all(like)
        : db.prepare('SELECT id, content, source FROM entries ORDER BY created_at DESC LIMIT 12').all();
      return (rows as any[]).map(r => mk(r.id, firstLine(r.content), r.source || undefined));
    }
    if (refType === 'document') {
      const rows = raw.trim()
        ? db.prepare('SELECT id, title FROM documents WHERE title LIKE ? ORDER BY updated_at DESC LIMIT 12').all(like)
        : db.prepare('SELECT id, title FROM documents ORDER BY updated_at DESC LIMIT 12').all();
      return (rows as any[]).map(r => mk(r.id, r.title));
    }
    if (refType === 'map') {
      const rows = raw.trim()
        ? db.prepare('SELECT id, title FROM maps WHERE title LIKE ? ORDER BY updated_at DESC LIMIT 12').all(like)
        : db.prepare('SELECT id, title FROM maps ORDER BY updated_at DESC LIMIT 12').all();
      return (rows as any[]).map(r => mk(r.id, r.title));
    }
    return [];
  }

  const base = baseUrl(app);
  if (!base) return [];

  if (app === 'navigate') {
    const papers = asArray(await fetchJsonCached(`${base}/api/papers`), 'papers');
    const matched = papers.filter(p => !q || includesCI(p.title, q) || includesCI(p.arxiv_id, q));
    return matched.slice(0, 12).map(p =>
      refType === 'paper_id'
        ? mk(String(p.id), p.title || String(p.id), p.arxiv_id)
        : mk(String(p.arxiv_id), p.title || String(p.arxiv_id), p.arxiv_id)
    );
  }

  if (app === 'scribe') {
    if (refType === 'book_id') {
      const books = asArray(await fetchJsonCached(`${base}/api/attachments`), 'attachments');
      return books.filter(b => !q || includesCI(b.filename, q) || includesCI(b.subject, q))
        .slice(0, 12).map(b => mk(b.id, b.filename || b.id, b.subject || undefined));
    }
    if (refType === 'note_id') {
      const notes = asArray(await fetchJsonCached(`${base}/api/notes`), 'notes');
      return notes.filter(n => !q || includesCI(n.title, q))
        .slice(0, 12).map(n => mk(n.id, n.title || n.id));
    }
    if (refType === 'flowchart_node') {
      if (!raw.trim()) return []; // node search requires a title
      const nodes = asArray(await fetchJsonCached(`${base}/api/flowcharts/nodes/search?title=${encodeURIComponent(raw.trim())}`), 'nodes');
      return nodes.slice(0, 12).map(n => {
        const fid = n.flowchartId ?? n.flowchart_id;
        const nk = n.nodeKey ?? n.node_key;
        return mk(`${fid}:${nk}`, n.title || `${fid}:${nk}`, 'flowchart node');
      });
    }
    return [];
  }

  if (app === 'monolith') {
    if (refType !== 'project') return []; // `file` needs project context — manual entry
    const projects = asArray(await fetchJsonCached(`${base}/api/projects`), 'projects');
    return projects
      .map((p: any) => (typeof p === 'string' ? p : p?.name))
      .filter((name: unknown) => typeof name === 'string' && (!q || includesCI(name, q)))
      .slice(0, 12)
      .map((name: string) => mk(name, name));
  }

  if (app === 'pyramid') {
    const url = raw.trim() ? `${base}/api/sessions?search=${encodeURIComponent(raw.trim())}` : `${base}/api/sessions`;
    const sessions = asArray(await fetchJsonCached(url), 'sessions');
    return sessions.slice(0, 12).map((s: any) => mk(s.id, s.title || s.id, s.session_type || undefined));
  }

  return [];
}

// GET /api/interop/search?app=&ref_type=&q=
router.get('/search', async (req: Request, res: Response) => {
  try {
    const app = String(req.query.app || '');
    const refType = String(req.query.ref_type || '');
    const q = String(req.query.q || '');
    const results = await searchRecords(app, refType, q);
    res.json(results.slice(0, 12));
  } catch {
    res.json([]);
  }
});

// GET /api/interop/base-urls — resolved sibling origins for building jump links.
router.get('/base-urls', (_req: Request, res: Response) => {
  res.json({
    navigate: baseUrl('navigate'),
    scribe: baseUrl('scribe'),
    monolith: baseUrl('monolith'),
    pyramid: baseUrl('pyramid'),
  });
});

export default router;
