import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { format } from 'date-fns';
import { Entry, HeatmapEntry } from '../../types';
import { entryService, daySummaryService, statsService } from '../../services/api';
import TimelineItem from '../../components/TimelineItem/TimelineItem';
import TimelineScratch from '../../components/TimelineScratch/TimelineScratch';
import styles from './TimelinePage.module.css';

const WINDOW_DAYS = 21;

// CST (UTC-6) helpers — mirror the server's date(created_at, '-6 hours').
function cstDateOf(iso: string): string {
  return new Date(new Date(iso).getTime() - 6 * 3600 * 1000).toISOString().slice(0, 10);
}
function todayCstStr(): string {
  return new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
}
// Calendar-date arithmetic on a YYYY-MM-DD string (UTC math avoids DST drift).
function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

interface DayGroup {
  dateCst: string;
  scratch: string | null;
  entries: Entry[];
}

function dayLabel(dateCst: string, today: string): string {
  const base = format(new Date(`${dateCst}T12:00:00`), 'EEEE, MMMM d, yyyy');
  if (dateCst === today) return `Today · ${base}`;
  if (dateCst === shiftDate(today, -1)) return `Yesterday · ${base}`;
  return base;
}

// A continuous, time-ordered stream of all entries. Newest sits at the bottom;
// scrolling up loads older days (chat-style reverse infinite scroll). Days with a
// non-empty scratchpad show an auto-scrolling strip beneath their divider.
export default function TimelinePage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [scratch, setScratch] = useState<Record<string, string>>({});
  const [oldestLoaded, setOldestLoaded] = useState('');
  const [earliest, setEarliest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef(0);
  const anchoredRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const mergeEntries = useCallback((incoming: Entry[]) => {
    setEntries(prev => {
      const map = new Map(prev.map(e => [e.id, e]));
      for (const e of incoming) map.set(e.id, e);
      return Array.from(map.values());
    });
  }, []);

  const mergeScratch = useCallback((rows: { date_cst: string; scratch: string }[]) => {
    setScratch(prev => {
      const next = { ...prev };
      for (const r of rows) next[r.date_cst] = r.scratch;
      return next;
    });
  }, []);

  const fetchEntries = useCallback(
    (start: string, end: string) => entryService.list({ start, end }),
    []
  );

  // Initial window: today back WINDOW_DAYS for entries. The earliest entry date
  // (heatmap) and earliest scratch date together form the stop condition for
  // loading older windows.
  useEffect(() => {
    let cancelled = false;
    const end = todayCstStr();
    const start = shiftDate(end, -(WINDOW_DAYS - 1));
    Promise.all([
      fetchEntries(start, end),
      statsService.heatmap().catch(() => [] as HeatmapEntry[]),
      // Scratch is one small row per day, so load it all up front. This lets days
      // with a scratchpad but no entries appear in the stream — including ones
      // older than the earliest entry.
      daySummaryService.listScratch('1970-01-01', end).catch(() => []),
    ])
      .then(([es, heat, scratchRows]) => {
        if (cancelled) return;
        const entryDates = heat.filter(h => h.count > 0).map(h => h.date);
        const earliestEntry = entryDates.length ? entryDates.reduce((a, b) => (a < b ? a : b)) : null;
        const scratchDates = scratchRows.map(r => r.date_cst);
        const earliestScratch = scratchDates.length ? scratchDates.reduce((a, b) => (a < b ? a : b)) : null;
        const candidates = [earliestEntry, earliestScratch].filter((d): d is string => !!d);
        const earliestDate = candidates.length ? candidates.sort()[0] : null;
        setEarliest(earliestDate);
        mergeEntries(es);
        mergeScratch(scratchRows);
        setOldestLoaded(start);
        setHasMore(earliestDate ? start > earliestDate : false);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchEntries, mergeEntries, mergeScratch]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || !oldestLoaded) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const end = shiftDate(oldestLoaded, -1);
    const start = shiftDate(oldestLoaded, -WINDOW_DAYS);
    const el = scrollRef.current;
    prevHeightRef.current = el ? el.scrollHeight : 0;
    try {
      const es = await fetchEntries(start, end);
      mergeEntries(es);
      setOldestLoaded(start);
      setHasMore(earliest ? start > earliest : false);
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [hasMore, oldestLoaded, earliest, fetchEntries, mergeEntries]);

  // Group entries by CST day, ascending so the newest day/entry renders at the bottom.
  const groups = useMemo<DayGroup[]>(() => {
    const today = todayCstStr();
    const byDay = new Map<string, Entry[]>();
    for (const e of entries) {
      const d = cstDateOf(e.created_at);
      const list = byDay.get(d);
      if (list) list.push(e);
      else byDay.set(d, [e]);
    }
    // Include scratch-only days within the loaded window so a day with a
    // scratchpad but no entries still gets its own divider + strip.
    for (const d of Object.keys(scratch)) {
      if (d >= oldestLoaded && d <= today && !byDay.has(d)) byDay.set(d, []);
    }
    return Array.from(byDay.keys()).sort().map(d => ({
      dateCst: d,
      scratch: scratch[d] ?? null,
      entries: byDay.get(d)!.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }));
  }, [entries, scratch, oldestLoaded]);

  // Anchor to the bottom (now) once, after the first content render.
  useLayoutEffect(() => {
    if (loading || anchoredRef.current) return;
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      anchoredRef.current = true;
    }
  }, [loading, groups.length]);

  // Keep the viewport steady when older content is prepended above the fold. Keyed
  // on both entries and oldestLoaded so it also fires for scratch-only windows
  // (which move oldestLoaded back without adding any entries).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && prevHeightRef.current) {
      el.scrollTop += el.scrollHeight - prevHeightRef.current;
      prevHeightRef.current = 0;
    }
  }, [entries, oldestLoaded]);

  // Load older days as the top sentinel scrolls into view.
  useEffect(() => {
    if (loading || !hasMore) return;
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const obs = new IntersectionObserver(
      es => { if (es[0]?.isIntersecting) loadMore(); },
      { root, rootMargin: '150px 0px 0px 0px' }
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [loading, hasMore, loadMore]);

  const today = todayCstStr();

  return (
    <div className={styles.page}>
      <div className={styles.scroll} ref={scrollRef}>
        <div className={styles.inner}>
          <div ref={sentinelRef} className={styles.sentinel} />
          {loadingMore && <div className={styles.note}>Loading earlier days…</div>}
          {!loading && !hasMore && groups.length > 0 && (
            <div className={styles.note}>Beginning of timeline</div>
          )}
          {loading ? (
            <div className={styles.note}>Loading…</div>
          ) : groups.length === 0 ? (
            <div className={styles.empty}>No entries yet.</div>
          ) : (
            groups.map(g => (
              <section key={g.dateCst} className={styles.day}>
                <div className={styles.divider}>
                  <span className={styles.dividerNode} />
                  <span className={styles.dividerLabel}>{dayLabel(g.dateCst, today)}</span>
                </div>
                {g.scratch && g.scratch.trim() && (
                  <TimelineScratch text={g.scratch} dateCst={g.dateCst} />
                )}
                <div className={styles.items}>
                  {g.entries.map(e => <TimelineItem key={e.id} entry={e} />)}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
