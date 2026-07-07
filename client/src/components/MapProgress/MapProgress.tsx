import { useCallback, useRef, useState } from 'react';
import { MinusIcon, PlusIcon } from '../Icons/Icons';
import styles from './MapProgress.module.css';

interface Props {
  value: number | null;
  onChange: (v: number) => void; // commit a numeric value (0-100)
  onClear: () => void; // reset to null (unset)
}

const STEP = 5;
const PRESETS = [0, 25, 50, 75, 100];

function snap(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n / STEP) * STEP));
}

/**
 * Interactive progress control for a map. The track itself is a slider — click
 * or drag anywhere to set the percentage; the ± buttons bump by 5; the preset
 * chips jump to common milestones. Replaces the old number textbox.
 *
 * `value === null` means progress is unset (honestly distinct from 0%). The
 * first interaction commits a concrete number; the ✕ chip clears back to unset.
 */
export default function MapProgress({ value, onChange, onClear }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const current = value ?? 0;
  const unset = value == null;

  const valueFromClientX = useCallback((clientX: number): number => {
    const el = trackRef.current;
    if (!el) return current;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return snap(ratio * 100);
  }, [current]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    onChange(valueFromClientX(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    onChange(valueFromClientX(e.clientX));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging) return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    setDragging(false);
  };

  const bump = (delta: number) => onChange(snap(current + delta));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); bump(-STEP); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); bump(STEP); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(0); }
    else if (e.key === 'End') { e.preventDefault(); onChange(100); }
  };

  const complete = current >= 100;

  return (
    <div className={styles.wrap}>
      <div className={styles.mainRow}>
        <span className={`${styles.readout} ${unset ? styles.readoutUnset : ''} ${complete ? styles.readoutComplete : ''}`}>
          {unset ? '—' : `${current}%`}
        </span>

        <button
          type="button"
          className={styles.stepBtn}
          onClick={() => bump(-STEP)}
          disabled={!unset && current <= 0}
          aria-label="Decrease progress by 5%"
        >
          <MinusIcon size={15} />
        </button>

        <div
          ref={trackRef}
          className={`${styles.track} ${dragging ? styles.trackDragging : ''} ${unset ? styles.trackUnset : ''}`}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={current}
          aria-label="Map progress"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={handleKeyDown}
        >
          <div
            className={`${styles.fill} ${complete ? styles.fillComplete : ''}`}
            style={{ width: `${current}%` }}
          />
          {unset && <span className={styles.hint}>Set progress</span>}
          {!unset && <span className={styles.knob} style={{ left: `${current}%` }} />}
        </div>

        <button
          type="button"
          className={styles.stepBtn}
          onClick={() => bump(STEP)}
          disabled={current >= 100}
          aria-label="Increase progress by 5%"
        >
          <PlusIcon size={15} />
        </button>
      </div>

      <div className={styles.presetRow}>
        {PRESETS.map(p => (
          <button
            type="button"
            key={p}
            className={`${styles.preset} ${!unset && current === p ? styles.presetActive : ''}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className={styles.clear}
          onClick={onClear}
          disabled={unset}
          title="Clear progress (unset)"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
