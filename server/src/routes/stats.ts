import { Router, Request, Response } from 'express';
import db from '../db';
import { getCSTDate } from '../services/fsrs';

const router = Router();

router.get('/overview', (_req: Request, res: Response) => {
  try {
    const today = getCSTDate();

    const dueToday = db.prepare('SELECT COUNT(*) as count FROM review_cards WHERE due_date <= ?').get(today) as { count: number };

    const byState = db.prepare(`
      SELECT state, COUNT(*) as count FROM review_cards GROUP BY state
    `).all() as { state: string; count: number }[];

    const totalCards = db.prepare('SELECT COUNT(*) as count FROM review_cards').get() as { count: number };

    // Retention rate: % of reviews rated good or easy in last 30 days
    const thirtyDaysAgo = getCSTDate(-30);
    const totalReviews = db.prepare(
      'SELECT COUNT(*) as count FROM review_log WHERE reviewed_at >= ?'
    ).get(thirtyDaysAgo) as { count: number };
    const goodReviews = db.prepare(
      "SELECT COUNT(*) as count FROM review_log WHERE reviewed_at >= ? AND rating IN ('good', 'easy')"
    ).get(thirtyDaysAgo) as { count: number };

    const retentionRate = totalReviews.count > 0
      ? Math.round((goodReviews.count / totalReviews.count) * 100)
      : 0;

    res.json({
      due_today: dueToday.count,
      total_cards: totalCards.count,
      by_state: byState,
      retention_rate: retentionRate,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

router.get('/heatmap', (req: Request, res: Response) => {
  try {
    const start = (req.query.start as string) || getCSTDate(-180);
    const end = (req.query.end as string) || getCSTDate();

    const rows = db.prepare(`
      SELECT date(created_at, '-6 hours') as date, COUNT(*) as count
      FROM entries
      WHERE date(created_at, '-6 hours') BETWEEN ? AND ?
      GROUP BY date(created_at, '-6 hours')
      ORDER BY date
    `).all(start, end);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

router.get('/forecast', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const today = getCSTDate();
    const endDate = getCSTDate(days);

    const rows = db.prepare(`
      SELECT due_date, COUNT(*) as count
      FROM review_cards
      WHERE due_date BETWEEN ? AND ?
      GROUP BY due_date
      ORDER BY due_date
    `).all(today, endDate);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch forecast' });
  }
});

router.get('/review-history', (req: Request, res: Response) => {
  try {
    const start = (req.query.start as string) || getCSTDate(-30);
    const end = (req.query.end as string) || getCSTDate();

    const rows = db.prepare(`
      SELECT date(reviewed_at, '-6 hours') as date,
        COUNT(*) as total,
        SUM(CASE WHEN rating IN ('good', 'easy') THEN 1 ELSE 0 END) as correct
      FROM review_log
      WHERE date(reviewed_at, '-6 hours') BETWEEN ? AND ?
      GROUP BY date(reviewed_at, '-6 hours')
      ORDER BY date
    `).all(start, end);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch review history' });
  }
});

export default router;
