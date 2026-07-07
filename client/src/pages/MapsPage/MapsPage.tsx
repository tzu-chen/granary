import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mapService } from '../../services/api';
import { MapRecord, MapStatus, MAP_STATUSES } from '../../types';
import styles from './MapsPage.module.css';

// Current date in CST (UTC-6 fixed offset), YYYY-MM-DD.
function todayCst(): string {
  return new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isOverdue(map: MapRecord, today: string): boolean {
  if (!map.due_date) return false;
  if (map.status === 'completed' || map.status === 'abandoned') return false;
  return map.due_date < today;
}

export default function MapsPage() {
  const navigate = useNavigate();
  const [maps, setMaps] = useState<MapRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MapStatus | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);

  const today = todayCst();

  const load = useCallback(() => {
    setLoading(true);
    mapService.list({
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: search || undefined,
    })
      .then(setMaps)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load maps'))
      .finally(() => setLoading(false));
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Tag options derive from the server-fetched set (before the client-side tag filter),
  // so the dropdown stays stable as a tag is selected.
  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    maps.forEach(m => m.tags.forEach(t => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [maps]);

  const visibleMaps = useMemo(
    () => (tagFilter ? maps.filter(m => m.tags.includes(tagFilter)) : maps),
    [maps, tagFilter]
  );

  // Reordering only makes sense over the full, unfiltered list.
  const canReorder = statusFilter === 'all' && !tagFilter && !search;

  const handleDragStart = (id: string) => { dragItemRef.current = id; };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragOverId !== id) setDragOverId(id);
  };
  const handleDrop = async (targetId: string) => {
    const dragId = dragItemRef.current;
    setDragOverId(null);
    dragItemRef.current = null;
    if (!dragId || dragId === targetId || !canReorder) return;

    const orderedIds = visibleMaps.map(m => m.id);
    const dragIdx = orderedIds.indexOf(dragId);
    const targetIdx = orderedIds.indexOf(targetId);
    if (dragIdx === -1 || targetIdx === -1) return;
    orderedIds.splice(dragIdx, 1);
    orderedIds.splice(targetIdx, 0, dragId);

    setMaps(prev => {
      const byId = new Map(prev.map(m => [m.id, m]));
      const reordered: MapRecord[] = [];
      orderedIds.forEach(id => { const m = byId.get(id); if (m) reordered.push(m); });
      return reordered;
    });

    try {
      await mapService.reorder(orderedIds);
    } catch { /* ignore */ }
  };

  const statusPillClass = (status: MapStatus) => `${styles.statusPill} ${styles[`status_${status}`]}`;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Maps</h1>
          <p className={styles.summary}>
            {maps.length} map{maps.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link to="/maps/new" className={styles.btnPrimary}>New map</Link>
      </header>

      <div className={styles.searchRow}>
        <input
          className={styles.search}
          placeholder="Search title, scope, goal…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
      </div>

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="Status filter">
          <button
            type="button"
            className={`${styles.segment} ${statusFilter === 'all' ? styles.segmentActive : ''}`}
            onClick={() => setStatusFilter('all')}
            aria-pressed={statusFilter === 'all'}
          >
            All
          </button>
          {MAP_STATUSES.map(s => (
            <button
              key={s.value}
              type="button"
              className={`${styles.segment} ${statusFilter === s.value ? styles.segmentActive : ''}`}
              onClick={() => setStatusFilter(s.value)}
              aria-pressed={statusFilter === s.value}
            >
              {s.label}
            </button>
          ))}
        </div>

        {tagOptions.length > 0 && (
          <label className={styles.tagControl}>
            <span className={styles.tagLabel}>Tag</span>
            <select
              className={styles.tagSelect}
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
            >
              <option value="">All</option>
              {tagOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.loading}>Loading…</div>
      ) : visibleMaps.length === 0 ? (
        <div className={styles.empty}>
          {search || statusFilter !== 'all' || tagFilter ? (
            <p>No maps match the current filters.</p>
          ) : (
            <>
              <p>No maps yet.</p>
              <Link to="/maps/new" className={styles.btnPrimary}>Create your first map</Link>
            </>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {visibleMaps.map(map => {
            const overdue = isOverdue(map, today);
            const counts = map.item_counts ?? { total: 0, done: 0 };
            return (
              <div
                key={map.id}
                className={`${styles.card} ${styles[`card_${map.status}`]} ${dragOverId === map.id ? styles.dragOver : ''}`}
                draggable={canReorder}
                onDragStart={() => handleDragStart(map.id)}
                onDragOver={e => handleDragOver(e, map.id)}
                onDrop={() => handleDrop(map.id)}
                onClick={() => navigate(`/maps/${map.id}`)}
                role="link"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') navigate(`/maps/${map.id}`); }}
              >
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>{map.title}</h3>
                  <span className={statusPillClass(map.status)}>{map.status}</span>
                </div>

                {(map.goal || map.description) && (
                  <p className={styles.cardPreview}>{map.goal || map.description}</p>
                )}

                {map.progress_pct != null && (
                  <div className={styles.progressRow}>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${map.progress_pct}%` }} />
                    </div>
                    <span className={styles.progressLabel}>{map.progress_pct}%</span>
                  </div>
                )}

                <div className={styles.cardMeta}>
                  {map.tags.map(tag => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                  {map.due_date && (
                    <span className={`${styles.due} ${overdue ? styles.dueOverdue : ''}`}>
                      {overdue ? 'overdue ' : 'due '}{map.due_date}
                    </span>
                  )}
                  {counts.total > 0 && (
                    <span className={styles.itemCount} title={`${counts.done} of ${counts.total} items done`}>
                      {counts.done}/{counts.total} items
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
