import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocuments } from '../../hooks/useDocuments';
import { documentService } from '../../services/api';
import { Document, DocumentFilters as Filters, DocumentStats } from '../../types';
import DocumentCard from '../../components/DocumentCard/DocumentCard';
import DocumentFilters from '../../components/DocumentFilters/DocumentFilters';
import DocumentImportModal from '../../components/DocumentImportModal/DocumentImportModal';
import styles from './LibraryPage.module.css';

export default function LibraryPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [searchInput, setSearchInput] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const { documents, loading, error, refresh } = useDocuments(filters);

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

  const handleImported = (created: Document[]) => {
    void created;
    refresh();
  };

  const summary = useMemo(() => {
    if (!stats) return null;
    const kb = Math.round(stats.total_bytes / 1024);
    return `${stats.total} document${stats.total === 1 ? '' : 's'} · ${stats.with_open_todos} with open TODOs · ${kb} KB`;
  }, [stats]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Library</h1>
          {summary && <p className={styles.summary}>{summary}</p>}
        </div>
        <div className={styles.headerActions}>
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

      <DocumentFilters filters={filters} onChange={setFilters} />

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.loading}>Loading…</div>
      ) : documents.length === 0 ? (
        <div className={styles.empty}>
          {filters.search || filters.tag || filters.source ? (
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
        <div className={styles.grid}>
          {documents.map(doc => (
            <DocumentCard key={doc.id} document={doc} />
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
