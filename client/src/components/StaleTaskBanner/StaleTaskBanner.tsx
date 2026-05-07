import styles from './StaleTaskBanner.module.css';

interface Props {
  daysOpen: number;
  onKeep: () => void;
  onRedefine: () => void;
  onAbandon: () => void;
}

export default function StaleTaskBanner({ daysOpen, onKeep, onRedefine, onAbandon }: Props) {
  return (
    <div className={styles.banner} role="status">
      <span className={styles.message}>
        Rolling {daysOpen} days — keep, redefine, or abandon?
      </span>
      <div className={styles.actions}>
        <button type="button" className={styles.actionBtn} onClick={onKeep}>Keep</button>
        <button type="button" className={styles.actionBtn} onClick={onRedefine}>Redefine</button>
        <button type="button" className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={onAbandon}>
          Abandon
        </button>
      </div>
    </div>
  );
}
