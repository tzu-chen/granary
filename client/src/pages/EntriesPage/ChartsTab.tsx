import { useState, useEffect } from 'react';
import { ForecastEntry, ReviewHistoryEntry } from '../../types';
import { statsService } from '../../services/api';
import ForecastChart from '../../components/ForecastChart/ForecastChart';
import RetentionChart from '../../components/RetentionChart/RetentionChart';
import styles from './ChartsTab.module.css';

export default function ChartsTab() {
  const [forecastData, setForecastData] = useState<ForecastEntry[]>([]);
  const [historyData, setHistoryData] = useState<ReviewHistoryEntry[]>([]);

  useEffect(() => {
    statsService.forecast(30).then(setForecastData).catch(() => {});
    statsService.reviewHistory().then(setHistoryData).catch(() => {});
  }, []);

  return (
    <div className={styles.charts}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Review Forecast (30 days)</h3>
        <ForecastChart data={forecastData} />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Retention Over Time</h3>
        <RetentionChart data={historyData} />
      </section>
    </div>
  );
}
