import { useState, useEffect } from 'react';
import { ForecastEntry, ReviewHistoryEntry, TagCount } from '../../types';
import { statsService, tagService, entryService } from '../../services/api';
import ForecastChart from '../../components/ForecastChart/ForecastChart';
import RetentionChart from '../../components/RetentionChart/RetentionChart';
import styles from './ChartsTab.module.css';

export default function ChartsTab() {
  const [forecastData, setForecastData] = useState<ForecastEntry[]>([]);
  const [historyData, setHistoryData] = useState<ReviewHistoryEntry[]>([]);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [sources, setSources] = useState<{ source: string; count: number }[]>([]);

  useEffect(() => {
    statsService.forecast(30).then(setForecastData).catch(() => {});
    statsService.reviewHistory().then(setHistoryData).catch(() => {});
    tagService.list().then(setTags).catch(() => {});

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
    <div className={styles.charts}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Review Forecast (30 days)</h3>
        <ForecastChart data={forecastData} />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Retention Over Time</h3>
        <RetentionChart data={historyData} />
      </section>

      <div className={styles.twoCol}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Tags</h3>
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
          <h3 className={styles.sectionTitle}>Sources</h3>
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
