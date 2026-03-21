import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

interface ScribeAttachment {
  id: string;
  filename: string;
  subject: string | null;
}

let cache: { data: ScribeAttachment[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000;

function getScribeUrl(): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('scribe_url') as { value: string } | undefined;
  return row?.value || 'http://localhost:3003';
}

async function fetchAttachments(): Promise<ScribeAttachment[]> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const scribeUrl = getScribeUrl();
  const res = await fetch(`${scribeUrl}/api/attachments`);
  if (!res.ok) return [];

  const attachments = await res.json() as ScribeAttachment[];
  const mapped = attachments.map(a => ({ id: a.id, filename: a.filename, subject: a.subject ?? null }));
  cache = { data: mapped, timestamp: Date.now() };
  return mapped;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const q = (typeof _req.query.q === 'string' ? _req.query.q : '').trim().toLowerCase();
    const attachments = await fetchAttachments();

    let results = attachments;
    if (q) {
      results = attachments.filter(a => a.filename.toLowerCase().includes(q));
    }

    res.json(results.slice(0, 10));
  } catch {
    res.json([]);
  }
});

export default router;
