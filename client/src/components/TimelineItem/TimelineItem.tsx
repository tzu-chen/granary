import { useNavigate } from 'react-router-dom';
import { Entry, ENTRY_TYPES } from '../../types';
import MarkdownLatex from '../MarkdownLatex/MarkdownLatex';
import PriorityBadge from '../PriorityBadge/PriorityBadge';
import styles from './TimelineItem.module.css';

interface Props {
  entry: Entry;
}

const TYPE_COLORS: Record<string, string> = {
  note: 'var(--color-entry-note)',
  question: 'var(--color-entry-question)',
};

// A single compact stream item sitting on the timeline spine. The whole item is
// clickable (navigates to the entry detail), but clicks on inner links/buttons
// — e.g. links rendered inside the markdown content — pass through untouched, so
// we deliberately avoid wrapping everything in an <a> (no nested anchors).
export default function TimelineItem({ entry }: Props) {
  const navigate = useNavigate();
  const typeLabel = ENTRY_TYPES.find(t => t.value === entry.entry_type)?.label || entry.entry_type;
  const accentColor = TYPE_COLORS[entry.entry_type] || 'var(--color-text-muted)';
  const time = new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const open = () => navigate(`/entries/${entry.id}`);

  return (
    <div
      className={styles.item}
      role="link"
      tabIndex={0}
      onClick={e => { if (!(e.target as HTMLElement).closest('a, button')) open(); }}
      onKeyDown={e => { if (e.key === 'Enter') open(); }}
    >
      <div className={styles.rail}>
        <span className={styles.dot} style={{ background: accentColor }} />
      </div>
      <div className={styles.body}>
        <div className={styles.head}>
          <span className={styles.time}>{time}</span>
          <span className={styles.type} style={{ color: accentColor }}>{typeLabel}</span>
          {entry.status === 'open' && entry.priority && (
            <PriorityBadge priority={entry.priority} />
          )}
          {entry.is_reviewable && <span className={styles.srs}>SRS</span>}
        </div>
        <div className={styles.content}>
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
    </div>
  );
}
