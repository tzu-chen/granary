import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocuments } from '../../hooks/useDocuments';
import { documentService } from '../../services/api';
import { Document, DocumentFilters as Filters, DocumentStats } from '../../types';
import DocumentCard from '../../components/DocumentCard/DocumentCard';
import DocumentFilters from '../../components/DocumentFilters/DocumentFilters';
import DocumentImportModal from '../../components/DocumentImportModal/DocumentImportModal';
import { GridIcon, ListIcon } from '../../components/Icons/Icons';
import styles from './LibraryPage.module.css';

type ViewMode = 'card' | 'list';
type SortField = 'updated' | 'created' | 'title';

const VIEW_MODE_KEY = 'granary_library_view';
const SORT_KEY = 'granary_library_sort';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'created', label: 'Recently created' },
  { value: 'title', label: 'Title (A–Z)' },
];

function sortDocuments(docs: Document[], field: SortField): Document[] {
  const sorted = [...docs];
  sorted.sort((a, b) => {
    switch (field) {
      case 'title':
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      case 'created':
        return b.created_at.localeCompare(a.created_at);
      case 'updated':
      default:
        return b.updated_at.localeCompare(a.updated_at);
    }
  });
  return sorted;
}

export default function LibraryPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [searchInput, setSearchInput] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [stats, setStats] = useState<DocumentStats | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'card';
  });
  const [sortField, setSortField] = useState<SortField>(() => {
    const saved = localStorage.getItem(SORT_KEY);
    return saved === 'created' || saved === 'title' ? saved : 'updated';
  });

  // `showArchived` is the single source of truth for the archived scope; fold it
  // into the filters passed downstream so clearing other filters can't desync it.
  const effectiveFilters = useMemo<Filters>(
    () => ({ ...filters, archived: showArchived || undefined }),
    [filters, showArchived]
  );

  const { documents, loading, error, refresh } = useDocuments(effectiveFilters);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters(f => ({ ...f, search: searchInput.trim() || undefined }));
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    documentService.stats().then(setStats).catch(() => setStats(null));
  }, [documents.length]);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(SORT_KEY, sortField);
  }, [sortField]);

  const handleImported = (created: Document[]) => {
    void created;
    refresh();
  };

  const handleArchiveToggle = useCallback(async (doc: Document) => {
    await documentService.setArchived(doc.id, !doc.archived);
    refresh();
    documentService.stats().then(setStats).catch(() => setStats(null));
  }, [refresh]);

  // When searching, the server returns results ranked by relevance — keep that
  // order. Otherwise apply the user's chosen sort client-side.
  const isSearching = !!effectiveFilters.search;
  const visibleDocuments = useMemo(
    () => (isSearching ? documents : sortDocuments(documents, sortField)),
    [documents, sortField, isSearching]
  );

  const summary = useMemo(() => {
    if (!stats) return null;
    const kb = Math.round(stats.total_bytes / 1024);
    return `${stats.total} document${stats.total === 1 ? '' : 's'} · ${stats.with_open_todos} with open TODOs · ${kb} KB`;
  }, [stats]);

  const hasActiveFilters = !!(filters.tag || filters.source || filters.start || filters.end || filters.has_open_todos);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Library</h1>
          {summary && <p className={styles.summary}>{summary}</p>}
        </div>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle} role="group" aria-label="View mode">
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${viewMode === 'card' ? styles.viewToggleActive : ''}`}
              onClick={() => setViewMode('card')}
              title="Card view"
              aria-label="Card view"
              aria-pressed={viewMode === 'card'}
            >
              <GridIcon size={16} />
            </button>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleActive : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <ListIcon size={16} />
            </button>
          </div>
          <button className={styles.btnSecondary} onClick={() => setImportOpen(true)}>Import</button>
          <Link to="/library/new" className={styles.btnPrimary}>New</Link>
        </div>
      </header>

      <div className={styles.searchRow}>
        <input
          className={styles.search}
          placeholder="Search title, content, source, tags…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
      </div>

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="Library scope">
          <button
            type="button"
            className={`${styles.segment} ${!showArchived ? styles.segmentActive : ''}`}
            onClick={() => setShowArchived(false)}
            aria-pressed={!showArchived}
          >
            Active
            {stats && <span className={styles.segmentCount}>{stats.total}</span>}
          </button>
          <button
            type="button"
            className={`${styles.segment} ${showArchived ? styles.segmentActive : ''}`}
            onClick={() => setShowArchived(true)}
            aria-pressed={showArchived}
          >
            Archived
            {stats && <span className={styles.segmentCount}>{stats.archived}</span>}
          </button>
        </div>

        {!isSearching && (
          <label className={styles.sortControl}>
            <span className={styles.sortLabel}>Sort</span>
            <select
              className={styles.sortSelect}
              value={sortField}
              onChange={e => setSortField(e.target.value as SortField)}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <DocumentFilters filters={effectiveFilters} onChange={setFilters} />

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.loading}>Loading…</div>
      ) : visibleDocuments.length === 0 ? (
        <div className={styles.empty}>
          {showArchived ? (
            <p>No archived documents.</p>
          ) : filters.search || hasActiveFilters ? (
            <p>No documents match the current filters.</p>
          ) : (
            <>
              <p>No documents yet.</p>
              <button className={styles.btnPrimary} onClick={() => setImportOpen(true)}>
                Import your first markdown file
              </button>
            </>
          )}
        </div>
      ) : (
        <div className={viewMode === 'list' ? styles.list : styles.grid}>
          {visibleDocuments.map(doc => (
            <DocumentCard
              key={doc.id}
              document={doc}
              view={viewMode}
              onArchiveToggle={handleArchiveToggle}
            />
          ))}
        </div>
      )}

      {importOpen && (
        <DocumentImportModal
          onClose={() => setImportOpen(false)}
          onImported={handleImported}
        />
      )}
    </div>
  );
}
