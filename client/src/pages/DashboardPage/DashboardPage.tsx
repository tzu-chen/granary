import { useState, useEffect } from 'react';
import { StatsOverview, HeatmapEntry, ForecastEntry, ReviewHistoryEntry } from '../../types';
import { statsService } from '../../services/api';
import Heatmap from '../../components/Heatmap/Heatmap';
import ForecastChart from '../../components/ForecastChart/ForecastChart';
import RetentionChart from '../../components/RetentionChart/RetentionChart';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapEntry[]>([]);
  const [forecastData, setForecastData] = useState<ForecastEntry[]>([]);
  const [historyData, setHistoryData] = useState<ReviewHistoryEntry[]>([]);

  useEffect(() => {
    statsService.overview().then(setOverview).catch(() => {});
    statsService.heatmap().then(setHeatmapData).catch(() => {});
    statsService.forecast(30).then(setForecastData).catch(() => {});
    statsService.reviewHistory().then(setHistoryData).catch(() => {});
  }, []);

  return (
    <div className={styles.page}>
      {overview && (
        <div className={styles.overviewGrid}>
          <div className={styles.overviewCard}>
            <span className={styles.overviewValue}>{overview.due_today}</span>
            <span className={styles.overviewLabel}>Due Today</span>
          </div>
          <div className={styles.overviewCard}>
            <span className={styles.overviewValue}>{overview.total_cards}</span>
            <span className={styles.overviewLabel}>Total Cards</span>
          </div>
          <div className={styles.overviewCard}>
            <span className={styles.overviewValue}>{overview.retention_rate}%</span>
            <span className={styles.overviewLabel}>Retention (30d)</span>
          </div>
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Entry Activity</h2>
        <Heatmap data={heatmapData} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Review Forecast (30 days)</h2>
        <ForecastChart data={forecastData} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Retention Over Time</h2>
        <RetentionChart data={historyData} />
      </section>
    </div>
  );
}
