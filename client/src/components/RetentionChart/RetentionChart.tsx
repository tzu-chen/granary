import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ReviewHistoryEntry } from '../../types';
import styles from './RetentionChart.module.css';

interface Props {
  data: ReviewHistoryEntry[];
}

export default function RetentionChart({ data }: Props) {
  if (data.length === 0) {
    return <p className={styles.empty}>No review history yet</p>;
  }

  const chartData = data.map(d => ({
    date: d.date.slice(5),
    retention: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
  }));

  return (
    <div className={styles.container}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
          <Tooltip formatter={(value: number) => `${value}%`} />
          <Line type="monotone" dataKey="retention" stroke="var(--color-success)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
