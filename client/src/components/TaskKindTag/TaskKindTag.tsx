import { useState, useEffect, useRef } from 'react';
import { TaskKind, TASK_KINDS } from '../../types';
import styles from './TaskKindTag.module.css';

interface Props {
  kind: TaskKind;
  onChange: (kind: TaskKind) => void;
  size?: 'sm' | 'md';
  interactive?: boolean;
}

export default function TaskKindTag({ kind, onChange, size = 'md', interactive = true }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleSelect = (next: TaskKind) => {
    if (next !== kind) onChange(next);
    setOpen(false);
  };

  const currentLabel = TASK_KINDS.find(k => k.value === kind)?.label ?? kind;

  return (
    <div
      ref={wrapperRef}
      className={`${styles.wrapper} ${size === 'sm' ? styles.sm : ''}`}
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        className={`${styles.tag} ${styles[`kind_${kind}`]} ${!interactive ? styles.tagStatic : ''}`}
        onClick={() => interactive && setOpen(o => !o)}
        title={currentLabel}
        disabled={!interactive}
      >
        <span className={styles.dot} />
        <span className={styles.label}>{currentLabel}</span>
      </button>
      {open && (
        <div className={styles.popover}>
          <ul className={styles.options}>
            {TASK_KINDS.map(opt => (
              <li key={opt.value}>
                <button
                  type="button"
                  className={`${styles.optionRow} ${opt.value === kind ? styles.optionRowActive : ''}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span className={`${styles.optionPill} ${styles[`kind_${opt.value}`]}`}>
                    <span className={styles.dot} />
                    {opt.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
