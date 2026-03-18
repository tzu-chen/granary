import { EntryPriority } from '../../types';
import styles from './PriorityBadge.module.css';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'var(--color-priority-high)',
  medium: 'var(--color-priority-medium)',
  low: 'var(--color-priority-low)',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

interface Props {
  priority: NonNullable<EntryPriority>;
  onClick?: () => void;
}

export default function PriorityBadge({ priority, onClick }: Props) {
  const color = PRIORITY_COLORS[priority];
  const label = PRIORITY_LABELS[priority];

  if (onClick) {
    return (
      <button
        className={styles.badge}
        style={{ background: color }}
        onClick={onClick}
        title={`Priority: ${label} (click to change)`}
      >
        {label}
      </button>
    );
  }

  return (
    <span className={styles.badge} style={{ background: color }} title={`Priority: ${label}`}>
      {label}
    </span>
  );
}
