import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Entry, TagCount, ENTRY_TYPES } from '../../types';
import { entryService, tagService } from '../../services/api';
import MarkdownLatex from '../../components/MarkdownLatex/MarkdownLatex';
import styles from './SearchTab.module.css';

const TYPE_COLORS: Record<string, string> = {
  definition: 'var(--color-entry-definition)',
  theorem: 'var(--color-entry-theorem)',
  proof_sketch: 'var(--color-entry-proof)',
  counterexample: 'var(--color-entry-counterexample)',
  exercise: 'var(--color-entry-exercise)',
  question: 'var(--color-entry-question)',
  insight: 'var(--color-entry-insight)',
  example: 'var(--color-entry-example)',
  note: 'var(--color-entry-note)',
};

function getCSTDate(dateStr: string): string {
  const d = new Date(dateStr);
  const cst = new Date(d.getTime() - 6 * 60 * 60 * 1000);
  return cst.toISOString().slice(0, 10);
}

function getDefaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function SearchTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [filterTag, setFilterTag] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReviewable, setFilterReviewable] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const initialLoad = useRef(true);

  // Load tags on mount
  useEffect(() => {
    tagService.list().then(setTags).catch(() => {});
  }, []);

  const fetchResults = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      if (filterTag) params.tag = filterTag;
      if (filterType) params.entry_type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (filterReviewable) params.is_reviewable = filterReviewable;
      if (filterStart) params.start = filterStart;
      if (filterEnd) params.end = filterEnd;

      // When no search and no filters, show last 30 days
      if (!searchQuery && !filterTag && !filterType && !filterStatus && !filterReviewable && !filterStart && !filterEnd) {
        params.start = getDefaultStart();
      }

      const entries = await entryService.list(params);
      setResults(entries);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [filterTag, filterType, filterStatus, filterReviewable, filterStart, filterEnd]);

  // Initial load
  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      fetchResults('');
    }
  }, [fetchResults]);

  // Re-fetch when filters change
  useEffect(() => {
    if (!initialLoad.current) {
      fetchResults(query);
    }
  }, [filterTag, filterType, filterStatus, filterReviewable, filterStart, filterEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleSearchChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchResults(value);
    }, 500);
  };

  return (
    <div className={styles.searchTab}>
      {/* Search Input */}
      <div className={styles.searchBar}>
        <input
          type="text"
          className={styles.searchInput}
          value={query}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search entries..."
          autoFocus
        />
      </div>

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
        {tags.length > 0 && (
          <select
            className={styles.filterSelect}
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
          >
            <option value="">All tags</option>
            {tags.map(t => (
              <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>
            ))}
          </select>
        )}
        <select
          className={styles.filterSelect}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Any status</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          className={styles.filterSelect}
          value={filterReviewable}
          onChange={e => setFilterReviewable(e.target.value)}
        >
          <option value="">Any reviewable</option>
          <option value="true">Reviewable</option>
          <option value="false">Not reviewable</option>
        </select>
        <input
          type="date"
          className={styles.filterSelect}
          value={filterStart}
          onChange={e => setFilterStart(e.target.value)}
          title="Start date"
        />
        <input
          type="date"
          className={styles.filterSelect}
          value={filterEnd}
          onChange={e => setFilterEnd(e.target.value)}
          title="End date"
        />
      </div>

      {/* Results */}
      {loading && <div className={styles.loading}>Searching...</div>}

      {!loading && results.length === 0 && (
        <div className={styles.empty}>
          {query ? 'No results found.' : 'No entries in the last 30 days.'}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className={styles.resultCount}>{results.length} {results.length === 1 ? 'result' : 'results'}</div>
      )}

      <div className={styles.entries}>
        {results.map(entry => {
          const typeLabel = ENTRY_TYPES.find(t => t.value === entry.entry_type)?.label || entry.entry_type;
          const accentColor = TYPE_COLORS[entry.entry_type] || 'var(--color-text-muted)';
          const dateCst = getCSTDate(entry.created_at);

          return (
            <div key={entry.id} className={styles.card} style={{ borderLeftColor: accentColor }}>
              <div className={styles.cardHeader}>
                <span className={styles.typeBadge} style={{ background: accentColor }}>{typeLabel}</span>
                {entry.status === 'open' && <span className={styles.statusBadge} data-status="open">Open</span>}
                {entry.status === 'resolved' && <span className={styles.statusBadge} data-status="resolved">Resolved</span>}
                {entry.is_reviewable && <span className={styles.reviewableBadge}>SRS</span>}
                <div className={styles.cardActions}>
                  <Link to={`/entries/${entry.id}`} className={styles.actionLink}>View</Link>
                  <Link to={`/?date=${dateCst}`} className={styles.actionLink}>{dateCst}</Link>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
