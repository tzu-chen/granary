import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Entry, HeatmapEntry, TagCount } from '../../types';
import { entryService, statsService, tagService } from '../../services/api';
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
  const [tags, setTags] = useState<TagCount[]>([]);
  const [sources, setSources] = useState<{ source: string; count: number }[]>([]);

  const dateCst = format(date, 'yyyy-MM-dd');

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
    tagService.list().then(setTags).catch(() => {});
    entryService.list().then(allEntries => {
      const sourceCounts: Record<string, number> = {};
      for (const e of allEntries) {
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
          <DaySummary dateCst={dateCst} />
          <div className={styles.formSection}>
            <h3 className={styles.formTitle}>New Entry</h3>
            <EntryForm onSubmit={handleCreate} />
          </div>

          <div className={styles.statsSection}>
            <section className={styles.statBlock}>
              <h3 className={styles.formTitle}>Entry Activity</h3>
              <Heatmap data={heatmapData} />
            </section>

            <div className={styles.breakdownColumns}>
              <section className={styles.statBlock}>
                <h3 className={styles.formTitle}>Tags</h3>
                {tags.length === 0 ? (
                  <p className={styles.emptyMuted}>No tags yet</p>
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

              <section className={styles.statBlock}>
                <h3 className={styles.formTitle}>Sources</h3>
                {sources.length === 0 ? (
                  <p className={styles.emptyMuted}>No sources yet</p>
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
