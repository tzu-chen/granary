import { useState, useEffect, useRef } from 'react';
import { TaskState, TASK_STATES } from '../../types';
import styles from './TaskStateTag.module.css';

interface Props {
  state: TaskState;
  reason?: string | null;
  onChange: (state: TaskState, reason?: string) => void;
  size?: 'sm' | 'md';
  interactive?: boolean;
}

export default function TaskStateTag({ state, reason, onChange, size = 'md', interactive = true }: Props) {
  const [open, setOpen] = useState(false);
  const [pendingState, setPendingState] = useState<TaskState | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPendingState(null);
        setReasonInput('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleSelect = (next: TaskState) => {
    if (next === state) {
      setOpen(false);
      return;
    }
    if (next === 'abandoned' || next === 'blocked') {
      setPendingState(next);
      setReasonInput(reason || '');
      return;
    }
    onChange(next);
    setOpen(false);
  };

  const handleReasonSubmit = (skip: boolean) => {
    if (!pendingState) return;
    onChange(pendingState, skip ? undefined : reasonInput.trim() || undefined);
    setPendingState(null);
    setReasonInput('');
    setOpen(false);
  };

  const currentLabel = TASK_STATES.find(s => s.value === state)?.label ?? state;

  return (
    <div
      ref={wrapperRef}
      className={`${styles.wrapper} ${size === 'sm' ? styles.sm : ''}`}
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        className={`${styles.tag} ${styles[`state_${state}`]} ${!interactive ? styles.tagStatic : ''}`}
        onClick={() => interactive && setOpen(o => !o)}
        title={reason ? `${currentLabel} — ${reason}` : currentLabel}
        disabled={!interactive}
      >
        <span className={styles.dot} />
        <span className={styles.label}>{currentLabel}</span>
      </button>
      {open && (
        <div className={styles.popover}>
          {pendingState ? (
            <div className={styles.reasonForm}>
              <div className={styles.reasonHeader}>
                Reason for {TASK_STATES.find(s => s.value === pendingState)?.label.toLowerCase()}?
              </div>
              <input
                className={styles.reasonInput}
                value={reasonInput}
                onChange={e => setReasonInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleReasonSubmit(false);
                  if (e.key === 'Escape') { setPendingState(null); setReasonInput(''); }
                }}
                placeholder="Optional one-liner..."
                autoFocus
              />
              <div className={styles.reasonActions}>
                <button type="button" className={styles.skipBtn} onClick={() => handleReasonSubmit(true)}>
                  Skip
                </button>
                <button type="button" className={styles.saveBtn} onClick={() => handleReasonSubmit(false)}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <ul className={styles.options}>
              {TASK_STATES.map(opt => (
                <li key={opt.value}>
                  <button
                    type="button"
                    className={`${styles.optionRow} ${opt.value === state ? styles.optionRowActive : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <span className={`${styles.optionPill} ${styles[`state_${opt.value}`]}`}>
                      <span className={styles.dot} />
                      {opt.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
