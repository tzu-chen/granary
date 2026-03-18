import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Entry, EntryType } from '../../types';
import { entryService } from '../../services/api';
import EntryForm from '../../components/EntryForm/EntryForm';
import styles from './EntryEditPage.module.css';

export default function EntryEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    entryService.get(id)
      .then(setEntry)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (data: { content: string; entry_type?: string; tags?: string[]; source?: string; priority?: string | null }) => {
    if (!id) return;
    await entryService.update(id, { ...data, status: entry?.status, priority: data.priority });
    navigate(`/entries/${id}`);
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('Delete this entry? This will also remove associated review cards.')) return;
    await entryService.delete(id);
    navigate('/');
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!entry) return <div className={styles.loading}>Entry not found</div>;

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Edit Entry</h2>
      <EntryForm
        initial={{
          content: entry.content,
          entry_type: entry.entry_type as EntryType,
          tags: entry.tags,
          source: entry.source || '',
          priority: entry.priority,
        }}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
      />
      <div className={styles.dangerZone}>
        <button className={styles.deleteBtn} onClick={handleDelete}>Delete Entry</button>
      </div>
    </div>
  );
}
