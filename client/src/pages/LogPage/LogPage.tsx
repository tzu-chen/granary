import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { Entry, HeatmapEntry } from '../../types';
import { entryService, statsService } from '../../services/api';
import DateNavigator from '../../components/DateNavigator/DateNavigator';
import DaySummary from '../../components/DaySummary/DaySummary';
import EntryCard from '../../components/EntryCard/EntryCard';
import EntryForm from '../../components/EntryForm/EntryForm';
import Heatmap from '../../components/Heatmap/Heatmap';
import styles from './LogPage.module.css';

export default function LogPage() {
  const [date, setDate] = useState(new Date());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPromote, setShowPromote] = useState<string | null>(null);
  const [promoteFront, setPromoteFront] = useState('');
  const [promoteBack, setPromoteBack] = useState('');
  const [heatmapData, setHeatmapData] = useState<HeatmapEntry[]>([]);

  const dateCst = format(date, 'yyyy-MM-dd');
  const todayCst = format(new Date(), 'yyyy-MM-dd');

  const currentStreak = useMemo(() => {
    const countMap: Record<string, number> = {};
    for (const d of heatmapData) countMap[d.date] = d.count;
    const cursor = new Date();
    // If today has no entries, start checking from yesterday
    const todayStr = cursor.toISOString().slice(0, 10);
    if (!countMap[todayStr]) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (true) {
      const dateStr = cursor.toISOString().slice(0, 10);
      if ((countMap[dateStr] || 0) > 0) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [heatmapData]);

  const loadEntries = useCallback(() => {
    setLoading(true);
    entryService.list({ date_cst: dateCst })
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [dateCst]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    statsService.heatmap().then(setHeatmapData).catch(() => {});
  }, []);

  const handleCreate = async (data: { content: string; entry_type?: string; tags?: string[]; source?: string; priority?: string | null }) => {
    await entryService.create(data);
    loadEntries();
  };

  const handlePromote = (entryId: string) => {
    setShowPromote(entryId);
    const entry = entries.find(e => e.id === entryId);
    if (entry) {
      setPromoteFront(entry.content.slice(0, 100) + (entry.content.length > 100 ? '...' : ''));
      setPromoteBack(entry.content);
    }
  };

  const submitPromote = async () => {
    if (!showPromote || !promoteFront.trim() || !promoteBack.trim()) return;
    await entryService.promote(showPromote, [{ front: promoteFront, back: promoteBack }]);
    setShowPromote(null);
    setPromoteFront('');
    setPromoteBack('');
    loadEntries();
  };

  return (
    <div className={styles.page}>
      <div className={styles.columns}>
        <div className={styles.leftColumn}>
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : entries.length === 0 ? (
            <div className={styles.empty}>No entries for this day. Start logging below.</div>
          ) : (
            <div className={styles.entries}>
              {entries.map(entry => (
                <EntryCard key={entry.id} entry={entry} onPromote={handlePromote} />
              ))}
            </div>
          )}
        </div>

        <div className={styles.rightColumn}>
          <DateNavigator date={date} onChange={setDate} />
          <DaySummary dateCst={dateCst} todayCst={todayCst} />
          <div className={styles.formSection}>
            <h3 className={styles.formTitle}>New Entry</h3>
            <EntryForm onSubmit={handleCreate} />
          </div>

          <div className={styles.statsSection}>
            <div className={styles.statsRow}>
              <section className={styles.statBlock}>
                <h3 className={styles.formTitle}>Entry Activity</h3>
                <Heatmap data={heatmapData} />
              </section>
              <section className={styles.statBlock}>
                <h3 className={styles.formTitle}>Current Streak</h3>
                <div className={styles.streakValue}>
                  {currentStreak}
                  <span className={styles.streakUnit}>{currentStreak === 1 ? 'day' : 'days'}</span>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {showPromote && (
        <div className={styles.promoteModal}>
          <div className={styles.promoteContent}>
            <h3>Create Review Card</h3>
            <label className={styles.label}>Front (question/prompt)</label>
            <textarea
              className={styles.promoteTextarea}
              value={promoteFront}
              onChange={e => setPromoteFront(e.target.value)}
              rows={3}
            />
            <label className={styles.label}>Back (answer)</label>
            <textarea
              className={styles.promoteTextarea}
              value={promoteBack}
              onChange={e => setPromoteBack(e.target.value)}
              rows={4}
            />
            <div className={styles.promoteActions}>
              <button className={styles.cancelBtn} onClick={() => setShowPromote(null)}>Cancel</button>
              <button className={styles.submitBtn} onClick={submitPromote}>Create Card</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
