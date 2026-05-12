import { useNavigate, useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { documentService } from '../../services/api';
import { useDocument } from '../../hooks/useDocument';
import DocumentRenderer from '../../components/DocumentRenderer/DocumentRenderer';
import styles from './DocumentDetailPage.module.css';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { doc, loading } = useDocument(id);

  const handleDelete = async () => {
    if (!id || !doc) return;
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    await documentService.delete(id);
    navigate('/library');
  };

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!doc) return <div className={styles.loading}>Document not found</div>;

  return (
    <div className={styles.page}>
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
          </div>
        </div>
        <div className={styles.actions}>
          <Link to={`/library/${doc.id}/edit`} className={styles.btn}>Edit</Link>
          <a href={documentService.exportUrl(doc.id)} className={styles.btn} download>Export</a>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDelete}>Delete</button>
        </div>
      </header>

      <DocumentRenderer content={doc.content} className={styles.body} />

      {doc.links.length > 0 && (
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
