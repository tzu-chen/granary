import { Link } from 'react-router-dom';
import { Entry, ENTRY_TYPES } from '../../types';
import MarkdownLatex from '../MarkdownLatex/MarkdownLatex';
import PriorityBadge from '../PriorityBadge/PriorityBadge';
import styles from './EntryCard.module.css';

interface Props {
  entry: Entry;
  onPromote?: (id: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  note: 'var(--color-entry-note)',
  question: 'var(--color-entry-question)',
};

export default function EntryCard({ entry, onPromote }: Props) {
  const typeLabel = ENTRY_TYPES.find(t => t.value === entry.entry_type)?.label || entry.entry_type;
  const accentColor = TYPE_COLORS[entry.entry_type] || 'var(--color-text-muted)';
  const time = new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={styles.card} style={{ borderLeftColor: accentColor }}>
      <div className={styles.header}>
        <span className={styles.badge} style={{ background: accentColor }}>{typeLabel}</span>
        {entry.status === 'open' && entry.priority && (
          <PriorityBadge priority={entry.priority} />
        )}
        <span className={styles.time}>{time}</span>
        <div className={styles.actions}>
          <Link to={`/entries/${entry.id}`} className={styles.link}>View</Link>
          <Link to={`/entries/${entry.id}/edit`} className={styles.link}>Edit</Link>
          {!entry.is_reviewable && onPromote && (
            <button className={styles.promoteBtn} onClick={() => onPromote(entry.id)}>
              Promote
            </button>
          )}
          {entry.is_reviewable && (
            <span className={styles.reviewable}>SRS</span>
          )}
        </div>
      </div>
      <MarkdownLatex content={entry.content} />
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
}
