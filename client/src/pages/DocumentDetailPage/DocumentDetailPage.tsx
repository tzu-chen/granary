import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { documentService } from '../../services/api';
import { useDocument } from '../../hooks/useDocument';
import { Document } from '../../types';
import DocumentRenderer from '../../components/DocumentRenderer/DocumentRenderer';
import {
  SinglePaneIcon,
  SplitColsIcon,
  SplitRowsIcon,
  SplitGridIcon,
  CloseIcon,
} from '../../components/Icons/Icons';
import styles from './DocumentDetailPage.module.css';

type DocLayout = 'single' | '1x2' | '2x1' | '2x2';

const LAYOUT_KEY = 'granary_doc_layout';

const LAYOUTS: { value: DocLayout; label: string; Icon: typeof SinglePaneIcon }[] = [
  { value: 'single', label: 'Single', Icon: SinglePaneIcon },
  { value: '1x2', label: 'Two columns', Icon: SplitColsIcon },
  { value: '2x1', label: 'Two rows', Icon: SplitRowsIcon },
  { value: '2x2', label: 'Grid of four', Icon: SplitGridIcon },
];

function isLayout(v: string | null): v is DocLayout {
  return v === 'single' || v === '1x2' || v === '2x1' || v === '2x2';
}

function paneCount(layout: DocLayout): number {
  if (layout === 'single') return 1;
  return layout === '2x2' ? 4 : 2;
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { doc, setDoc, loading } = useDocument(id);

  const [layout, setLayout] = useState<DocLayout>(() => {
    const saved = localStorage.getItem(LAYOUT_KEY);
    return isLayout(saved) ? saved : 'single';
  });
  // Comparison selections for the extra panes (pane 0 is always the current doc).
  const [compare, setCompare] = useState<(string | null)[]>([null, null, null]);
  const [allDocs, setAllDocs] = useState<Document[]>([]);

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, layout);
  }, [layout]);

  // Load the document list for the comparison pickers, once, when a split layout
  // is first activated.
  useEffect(() => {
    if (layout === 'single' || allDocs.length > 0) return;
    documentService.list().then(setAllDocs).catch(() => {});
  }, [layout, allDocs.length]);

  const handleDelete = async () => {
    if (!id || !doc) return;
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    await documentService.delete(id);
    navigate('/library');
  };

  const handleArchiveToggle = async () => {
    if (!id || !doc) return;
    const updated = await documentService.setArchived(id, !doc.archived);
    setDoc(updated);
  };

  const docsById = useMemo(() => {
    const m = new Map<string, Document>();
    for (const d of allDocs) m.set(d.id, d);
    return m;
  }, [allDocs]);

  const options = useMemo(
    () =>
      [...allDocs].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
      ),
    [allDocs],
  );

  const setCompareAt = (paneIndex: number, id: string | null) => {
    // paneIndex is 1-based across visible panes; compare[] is 0-based over extras.
    setCompare(prev => prev.map((s, i) => (i === paneIndex - 1 ? id : s)));
  };

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!doc) return <div className={styles.loading}>Document not found</div>;

  const split = layout !== 'single';
  const count = paneCount(layout);

  return (
    <div className={`${styles.page} ${split ? styles.pageSplit : ''}`}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <Link to="/library" className={styles.backLink}>← Library</Link>
          <h1 className={styles.title}>{doc.title}</h1>
          <div className={styles.meta}>
            {doc.source && <span className={styles.source}>{doc.source}</span>}
            {doc.tags.map(tag => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
            <span className={styles.updated}>Updated {format(new Date(doc.updated_at), 'PPp')}</span>
            {doc.total_todo_count > 0 && (
              <span className={styles.todoSummary}>
                ☐ {doc.open_todo_count} open / {doc.total_todo_count} total
              </span>
            )}
            {doc.imported_from && <span className={styles.imported}>imported from {doc.imported_from}</span>}
            {doc.archived && <span className={styles.archivedBadge}>Archived</span>}
          </div>
        </div>
        <div className={styles.actions}>
          <div className={styles.layoutToggle} role="group" aria-label="View layout">
            {LAYOUTS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className={`${styles.layoutBtn} ${layout === value ? styles.layoutActive : ''}`}
                onClick={() => setLayout(value)}
                title={label}
                aria-label={label}
                aria-pressed={layout === value}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
          <Link to={`/library/${doc.id}/edit`} className={styles.btn}>Edit</Link>
          <a href={documentService.exportUrl(doc.id)} className={styles.btn} download>Export</a>
          <button type="button" className={styles.btn} onClick={handleArchiveToggle}>
            {doc.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDelete}>Delete</button>
        </div>
      </header>

      {split ? (
        <div className={styles.grid} data-layout={layout}>
          {Array.from({ length: count }, (_, i) => {
            if (i === 0) {
              return (
                <section key="primary" className={styles.pane}>
                  <div className={styles.paneHeader}>
                    <span className={styles.paneTitle}>{doc.title}</span>
                  </div>
                  <div className={styles.paneBody}>
                    <DocumentRenderer content={doc.content} className={styles.paneContent} />
                  </div>
                </section>
              );
            }
            const selId = compare[i - 1];
            const cdoc = selId ? docsById.get(selId) : undefined;
            return (
              <section key={i} className={styles.pane}>
                <div className={styles.paneHeader}>
                  <select
                    className={styles.paneSelect}
                    value={selId ?? ''}
                    onChange={e => setCompareAt(i, e.target.value || null)}
                    aria-label={`Comparison document ${i}`}
                  >
                    <option value="">— Select a document —</option>
                    {options.map(d => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </select>
                  {selId && (
                    <button
                      type="button"
                      className={styles.paneClear}
                      onClick={() => setCompareAt(i, null)}
                      title="Clear pane"
                      aria-label="Clear pane"
                    >
                      <CloseIcon size={14} />
                    </button>
                  )}
                </div>
                <div className={styles.paneBody}>
                  {cdoc ? (
                    <DocumentRenderer content={cdoc.content} className={styles.paneContent} />
                  ) : selId ? (
                    <div className={styles.paneEmpty}>Document not found — it may be archived or deleted.</div>
                  ) : (
                    <div className={styles.paneEmpty}>Choose a document to compare.</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <DocumentRenderer content={doc.content} className={styles.body} />
      )}

      {!split && doc.links.length > 0 && (
        <aside className={styles.linkIndex}>
          <h3 className={styles.linkIndexTitle}>Cross-app links</h3>
          <ul className={styles.linkIndexList}>
            {doc.links.map(l => (
              <li key={`${l.app}:${l.ref_type}:${l.ref_id}`}>
                <span className={styles.linkApp}>{l.app}</span>
                <span className={styles.linkType}>{l.ref_type}</span>
                <span className={styles.linkId}>{l.ref_id}</span>
                {l.label && <span className={styles.linkLabel}>{l.label}</span>}
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
