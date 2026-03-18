import { useState, useEffect } from 'react';
import { StatsOverview, HeatmapEntry, ForecastEntry, ReviewHistoryEntry, TagCount } from '../../types';
import { statsService, tagService, entryService } from '../../services/api';
import Heatmap from '../../components/Heatmap/Heatmap';
import ForecastChart from '../../components/ForecastChart/ForecastChart';
import RetentionChart from '../../components/RetentionChart/RetentionChart';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapEntry[]>([]);
  const [forecastData, setForecastData] = useState<ForecastEntry[]>([]);
  const [historyData, setHistoryData] = useState<ReviewHistoryEntry[]>([]);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [sources, setSources] = useState<{ source: string; count: number }[]>([]);

  useEffect(() => {
    statsService.overview().then(setOverview).catch(() => {});
    statsService.heatmap().then(setHeatmapData).catch(() => {});
    statsService.forecast(30).then(setForecastData).catch(() => {});
    statsService.reviewHistory().then(setHistoryData).catch(() => {});
    tagService.list().then(setTags).catch(() => {});

    // Get source breakdown
    entryService.list().then(entries => {
      const sourceCounts: Record<string, number> = {};
      for (const e of entries) {
        if (e.source) {
          sourceCounts[e.source] = (sourceCounts[e.source] || 0) + 1;
        }
      }
      setSources(
        Object.entries(sourceCounts)
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count)
      );
    }).catch(() => {});
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

      <div className={styles.twoCol}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tags</h2>
          {tags.length === 0 ? (
            <p className={styles.empty}>No tags yet</p>
          ) : (
            <div className={styles.breakdown}>
              {tags.map(t => (
                <div key={t.tag} className={styles.breakdownRow}>
                  <span>{t.tag}</span>
                  <span className={styles.breakdownCount}>{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Sources</h2>
          {sources.length === 0 ? (
            <p className={styles.empty}>No sources yet</p>
          ) : (
            <div className={styles.breakdown}>
              {sources.map(s => (
                <div key={s.source} className={styles.breakdownRow}>
                  <span>{s.source}</span>
                  <span className={styles.breakdownCount}>{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
