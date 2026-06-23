import { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Document } from '../../types';
import { ArchiveIcon, ArchiveRestoreIcon } from '../Icons/Icons';
import styles from './DocumentCard.module.css';

interface Props {
  document: Document;
  view?: 'card' | 'list';
  onArchiveToggle?: (document: Document) => void;
}

function stripMarkdown(content: string, limit: number): string {
  // Strip code fences, math blocks, and the cross-app link braces to a label.
  let text = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^\n$]+?\$/g, ' ')
    .replace(/\[\[([\w]+):([\w]+):([^\|\]]+)(?:\|([^\]]+))?\]\]/g, (_m, _a, _t, id, label) => label || id)
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > limit) text = text.slice(0, limit).trimEnd() + '…';
  return text;
}

export default function DocumentCard({ document, view = 'card', onArchiveToggle }: Props) {
  const updated = formatDistanceToNow(new Date(document.updated_at), { addSuffix: true });
  const snippet = document.snippet || stripMarkdown(document.content, view === 'list' ? 140 : 200);

  const handleArchive = (e: MouseEvent) => {
    // The whole card is a link — stop the click from navigating.
    e.preventDefault();
    e.stopPropagation();
    onArchiveToggle?.(document);
  };

  const archiveButton = onArchiveToggle && (
    <button
      type="button"
      className={styles.archiveBtn}
      onClick={handleArchive}
      title={document.archived ? 'Unarchive' : 'Archive'}
      aria-label={document.archived ? 'Unarchive' : 'Archive'}
    >
      {document.archived ? <ArchiveRestoreIcon size={15} /> : <ArchiveIcon size={15} />}
    </button>
  );

  return (
    <Link to={`/library/${document.id}`} className={`${styles.card} ${view === 'list' ? styles.listCard : ''}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>{document.title}</h3>
        {document.open_todo_count > 0 && (
          <span className={styles.todoBadge} title={`${document.open_todo_count} open · ${document.total_todo_count} total`}>
            ☐ {document.open_todo_count}
          </span>
        )}
      </div>
      <div
        className={styles.snippet}
        dangerouslySetInnerHTML={document.snippet ? { __html: snippet } : undefined}
      >
        {document.snippet ? undefined : snippet}
      </div>
      <div className={styles.meta}>
        {document.source && <span className={styles.source}>{document.source}</span>}
        {document.tags.map(tag => (
          <span key={tag} className={styles.tag}>{tag}</span>
        ))}
        <span className={styles.updated}>{updated}</span>
        {archiveButton}
      </div>
    </Link>
  );
}
