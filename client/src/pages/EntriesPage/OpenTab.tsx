import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Entry, EntryPriority, OpenStats, ENTRY_TYPES, PRIORITY_OPTIONS } from '../../types';
import { entryService, openService } from '../../services/api';
import MarkdownLatex from '../../components/MarkdownLatex/MarkdownLatex';
import PriorityBadge from '../../components/PriorityBadge/PriorityBadge';
import ResolveForm from '../../components/ResolveForm/ResolveForm';
import styles from './OpenTab.module.css';

const TYPE_COLORS: Record<string, string> = {
  note: 'var(--color-entry-note)',
  question: 'var(--color-entry-question)',
};

function getAge(dateStr: string): string {
  const created = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function getCSTDate(dateStr: string): string {
  const d = new Date(dateStr);
  const cst = new Date(d.getTime() - 6 * 60 * 60 * 1000);
  return cst.toISOString().slice(0, 10);
}

const CYCLE_ORDER: NonNullable<EntryPriority>[] = ['high', 'medium', 'low'];

interface Props {
  onCountsChange: () => void;
}

export default function OpenTab({ onCountsChange }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<OpenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filterType) params.entry_type = filterType;
      if (filterTag) params.tag = filterTag;
      if (filterPriority) params.priority = filterPriority;
      if (showResolved) params.include_resolved = 'true';

      const [entriesData, statsData] = await Promise.all([
        openService.list(params),
        openService.stats(),
      ]);
      setEntries(entriesData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load open items:', err);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterTag, filterPriority, showResolved]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const handlePriorityChange = async (id: string, currentPriority: NonNullable<EntryPriority>) => {
    const idx = CYCLE_ORDER.indexOf(currentPriority);
    const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];

    setEntries(prev => prev.map(e => e.id === id ? { ...e, priority: next } : e));

    try {
      await entryService.updatePriority(id, next);
      const statsData = await openService.stats();
      setStats(statsData);
    } catch {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, priority: currentPriority } : e));
    }
  };

  const handleResolve = async (id: string, data: { content: string; tags?: string[]; entry_type?: string; source?: string }) => {
    try {
      await entryService.resolve(id, data);
      setResolvingId(null);
      loadData();
      onCountsChange();
    } catch (err) {
      console.error('Failed to resolve entry:', err);
    }
  };

  const handleReopen = async (id: string) => {
    try {
      await entryService.reopen(id);
      loadData();
      onCountsChange();
    } catch (err) {
      console.error('Failed to reopen entry:', err);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading open items...</div>;
  }

  const openEntries = entries.filter(e => e.status === 'open');
  const resolvedEntries = entries.filter(e => e.status === 'resolved');

  return (
    <div className={styles.openTab}>
      {/* Filters */}
      <div className={styles.filters}>
        <select
          className={styles.filterSelect}
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">All types</option>
          {ENTRY_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        {stats && stats.by_tag.length > 0 && (
          <select
            className={styles.filterSelect}
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
          >
            <option value="">All tags</option>
            {stats.by_tag.map(t => (
              <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>
            ))}
          </select>
        )}
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showResolved}
            onChange={e => setShowResolved(e.target.checked)}
          />
          Show resolved
        </label>
      </div>

      {/* Open Entries */}
      {openEntries.length === 0 && !showResolved && (
        <div className={styles.empty}>No open items found.</div>
      )}

      <div className={styles.entries}>
        {openEntries.map(entry => {
          const typeLabel = ENTRY_TYPES.find(t => t.value === entry.entry_type)?.label || entry.entry_type;
          const accentColor = TYPE_COLORS[entry.entry_type] || 'var(--color-text-muted)';
          const dateCst = getCSTDate(entry.created_at);

          return (
            <div key={entry.id} className={styles.card} style={{ borderLeftColor: accentColor }}>
              <div className={styles.cardHeader}>
                <span className={styles.typeBadge} style={{ background: accentColor }}>{typeLabel}</span>
                {entry.priority && (
                  <PriorityBadge
                    priority={entry.priority}
                    onClick={() => handlePriorityChange(entry.id, entry.priority!)}
                  />
                )}
                <span className={styles.age}>opened {getAge(entry.created_at)}</span>
                <div className={styles.cardActions}>
                  <Link to={`/entries/${entry.id}`} className={styles.actionLink}>View</Link>
                  <Link to={`/?date=${dateCst}`} className={styles.actionLink}>{dateCst}</Link>
                  <button
                    className={styles.resolveBtn}
                    onClick={() => setResolvingId(resolvingId === entry.id ? null : entry.id)}
                  >
                    Resolve
                  </button>
                </div>
              </div>
              <div className={styles.contentPreview}>
                <MarkdownLatex content={entry.content} />
              </div>
              {(entry.tags.length > 0 || entry.source) && (
                <div className={styles.meta}>
                  {entry.tags.map(tag => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                  {entry.source && <span className={styles.source}>{entry.source}</span>}
                </div>
              )}
              {resolvingId === entry.id && (
                <ResolveForm
                  entry={entry}
                  onSubmit={data => handleResolve(entry.id, data)}
                  onCancel={() => setResolvingId(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Resolved Entries */}
      {showResolved && resolvedEntries.length > 0 && (
        <>
          <div className={styles.sectionHeader}>Resolved</div>
          <div className={styles.entries}>
            {resolvedEntries.map(entry => {
              const typeLabel = ENTRY_TYPES.find(t => t.value === entry.entry_type)?.label || entry.entry_type;
              const accentColor = TYPE_COLORS[entry.entry_type] || 'var(--color-text-muted)';
              const resolvedEntry = entry as Entry & { resolution?: { resolved_at: string; resolution_content: string } };

              return (
                <div key={entry.id} className={`${styles.card} ${styles.resolved}`} style={{ borderLeftColor: accentColor }}>
                  <div className={styles.cardHeader}>
                    <span className={styles.typeBadge} style={{ background: accentColor }}>{typeLabel}</span>
                    <span className={styles.resolvedBadge}>Resolved</span>
                    <div className={styles.cardActions}>
                      <Link to={`/entries/${entry.id}`} className={styles.actionLink}>View</Link>
                      <button className={styles.reopenBtn} onClick={() => handleReopen(entry.id)}>Reopen</button>
                    </div>
                  </div>
                  <div className={styles.contentPreview}>
                    <MarkdownLatex content={entry.content} />
                  </div>
                  {resolvedEntry.resolution && (
                    <div className={styles.resolutionNote}>
                      <div className={styles.resolutionLabel}>Resolution:</div>
                      <MarkdownLatex content={resolvedEntry.resolution.resolution_content} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
