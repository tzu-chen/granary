import { useMemo } from 'react';
import { HeatmapEntry } from '../../types';
import styles from './Heatmap.module.css';

interface Props {
  data: HeatmapEntry[];
}

function getColor(count: number, max: number): string {
  if (count === 0) return 'var(--color-bg-tertiary)';
  const intensity = Math.min(count / Math.max(max, 1), 1);
  if (intensity < 0.25) return 'var(--color-accent-light)';
  if (intensity < 0.5) return 'rgba(99, 102, 241, 0.4)';
  if (intensity < 0.75) return 'rgba(99, 102, 241, 0.6)';
  return 'var(--color-accent)';
}

export default function Heatmap({ data }: Props) {
  const { weeks, max } = useMemo(() => {
    const countMap: Record<string, number> = {};
    let maxCount = 0;
    for (const d of data) {
      countMap[d.date] = d.count;
      if (d.count > maxCount) maxCount = d.count;
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 180);
    // Align to Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const allWeeks: { date: string; count: number }[][] = [];
    let currentWeek: { date: string; count: number }[] = [];
    const cursor = new Date(startDate);

    while (cursor <= today) {
      const dateStr = cursor.toISOString().slice(0, 10);
      currentWeek.push({ date: dateStr, count: countMap[dateStr] || 0 });
      if (currentWeek.length === 7) {
        allWeeks.push(currentWeek);
        currentWeek = [];
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      allWeeks.push(currentWeek);
    }

    return { weeks: allWeeks, max: maxCount };
  }, [data]);

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {weeks.map((week, wi) => (
          <div key={wi} className={styles.week}>
            {week.map(day => (
              <div
                key={day.date}
                className={styles.cell}
                style={{ background: getColor(day.count, max) }}
                title={`${day.date}: ${day.count} entries`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
