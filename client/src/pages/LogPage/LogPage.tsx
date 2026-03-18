import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Entry } from '../../types';
import { entryService } from '../../services/api';
import DateNavigator from '../../components/DateNavigator/DateNavigator';
import DaySummary from '../../components/DaySummary/DaySummary';
import EntryCard from '../../components/EntryCard/EntryCard';
import EntryForm from '../../components/EntryForm/EntryForm';
import styles from './LogPage.module.css';

export default function LogPage() {
  const [date, setDate] = useState(new Date());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPromote, setShowPromote] = useState<string | null>(null);
  const [promoteFront, setPromoteFront] = useState('');
  const [promoteBack, setPromoteBack] = useState('');

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
      <DateNavigator date={date} onChange={setDate} />
      <DaySummary dateCst={dateCst} />

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

      <div className={styles.formSection}>
        <h3 className={styles.formTitle}>New Entry</h3>
        <EntryForm onSubmit={handleCreate} />
      </div>
    </div>
  );
}
