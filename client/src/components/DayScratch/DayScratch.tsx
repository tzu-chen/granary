import { useState, useEffect, useRef, useCallback } from 'react';
import { daySummaryService } from '../../services/api';
import styles from './DayScratch.module.css';

interface Props {
  dateCst: string;
}

// A freeform per-day plain-text scratch lane. Collapsed, it's a one-line strip
// that auto-scrolls horizontally when its text overflows. Clicking expands it to
// a large editor overlay. Autosaves with a 1500ms debounce (app convention).
export default function DayScratch({ dateCst }: Props) {
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [duration, setDuration] = useState(20);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRef = useRef<(() => void) | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const flushSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    pendingRef.current?.();
  }, []);

  const scheduleSave = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const targetDate = dateCst;
    pendingRef.current = () => {
      daySummaryService.save(targetDate, { scratch: value.trim() ? value : null }).catch(() => {});
      pendingRef.current = null;
    };
    timerRef.current = setTimeout(() => {
      pendingRef.current?.();
      timerRef.current = undefined;
    }, 1500);
  };

  // Load on date change; flush any pending save for the previous date on cleanup.
  useEffect(() => {
    setExpanded(false);
    daySummaryService.get(dateCst)
      .then(d => setText(d.scratch || ''))
      .catch(() => setText(''));
    return () => { flushSave(); };
  }, [dateCst, flushSave]);

  // Measure overflow to decide whether the collapsed strip should marquee.
  useEffect(() => {
    const measure = () => {
      const body = bodyRef.current;
      const meas = measureRef.current;
      if (!body || !meas) return;
      const contentWidth = meas.scrollWidth;
      const over = contentWidth > body.clientWidth + 4;
      setOverflowing(over);
      if (over) setDuration(Math.max(8, contentWidth / 45));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text, expanded]);

  // Esc closes the expanded editor.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Focus the textarea (cursor at end) when expanding.
  useEffect(() => {
    if (!expanded) return;
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [expanded]);

  const handleChange = (value: string) => {
    setText(value);
    scheduleSave(value);
  };

  const close = () => {
    flushSave();
    setExpanded(false);
  };

  const hasText = text.trim().length > 0;

  return (
    <>
      <div
        className={styles.strip}
        role="button"
        tabIndex={0}
        title="Expand scratch"
        onClick={() => setExpanded(true)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(true); } }}
      >
        <span className={styles.stripIcon} aria-hidden="true">✎</span>
        <div className={styles.stripBody} ref={bodyRef}>
          {hasText ? (
            overflowing ? (
              <div className={styles.marquee} style={{ animationDuration: `${duration}s` }}>
                <span className={styles.marqueeContent}>{text}</span>
                <span className={styles.marqueeContent} aria-hidden="true">{text}</span>
              </div>
            ) : (
              <span className={styles.stripText}>{text}</span>
            )
          ) : (
            <span className={styles.stripPlaceholder}>Scratch — click to jot a quick note…</span>
          )}
          <span className={styles.measure} ref={measureRef} aria-hidden="true">{text}</span>
        </div>
        <span className={styles.expandIcon} aria-hidden="true">⤢</span>
      </div>

      {expanded && (
        <div className={styles.overlay} onMouseDown={close}>
          <div className={styles.panel} onMouseDown={e => e.stopPropagation()}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Scratch</span>
              <span className={styles.panelDate}>{dateCst}</span>
              <button type="button" className={styles.closeBtn} onClick={close}>Done</button>
            </div>
            <textarea
              ref={textareaRef}
              className={styles.panelTextarea}
              value={text}
              onChange={e => handleChange(e.target.value)}
              placeholder="Freeform notes — plain text, autosaves."
              spellCheck={false}
            />
          </div>
        </div>
      )}
    </>
  );
}
