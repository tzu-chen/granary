import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ForecastEntry } from '../../types';
import styles from './ForecastChart.module.css';

interface Props {
  data: ForecastEntry[];
}

export default function ForecastChart({ data }: Props) {
  if (data.length === 0) {
    return <p className={styles.empty}>No cards scheduled</p>;
  }

  const chartData = data.map(d => ({
    date: d.due_date.slice(5),
    count: d.count,
  }));

  return (
    <div className={styles.container}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="var(--color-accent)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
