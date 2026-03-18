import { format, addDays, subDays } from 'date-fns';
import styles from './DateNavigator.module.css';

interface Props {
  date: Date;
  onChange: (date: Date) => void;
}

export default function DateNavigator({ date, onChange }: Props) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const displayStr = format(date, 'EEEE, MMMM d, yyyy');
  const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

  return (
    <div className={styles.nav}>
      <button className={styles.arrow} onClick={() => onChange(subDays(date, 1))} aria-label="Previous day">
        &larr;
      </button>
      <div className={styles.center}>
        <span className={styles.date}>{displayStr}</span>
        {!isToday && (
          <button className={styles.today} onClick={() => onChange(new Date())}>Today</button>
        )}
      </div>
      <button className={styles.arrow} onClick={() => onChange(addDays(date, 1))} aria-label="Next day">
        &rarr;
      </button>
      <input
        className={styles.picker}
        type="date"
        value={dateStr}
        onChange={e => {
          const d = new Date(e.target.value + 'T12:00:00');
          if (!isNaN(d.getTime())) onChange(d);
        }}
      />
    </div>
  );
}
