import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { mapService } from '../../services/api';
import TagInput from '../../components/TagInput/TagInput';
import { MapRecord } from '../../types';
import styles from './MapEditPage.module.css';

interface Props {
  mode: 'new' | 'edit';
}

export default function MapEditPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [map, setMap] = useState<MapRecord | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    mapService.get(id)
      .then(m => {
        setMap(m);
        setTitle(m.title);
        setDescription(m.description || '');
        setGoal(m.goal || '');
        setTags(m.tags);
        setDueDate(m.due_date || '');
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => {
        setLoading(false);
        initialLoadDone.current = true;
      });
  }, [id, mode]);

  // Auto-save in edit mode (1500ms debounce). Skip the first render after load.
  const debounceTimer = useRef<number | null>(null);
  const performSave = useCallback(async () => {
    if (mode !== 'edit' || !id) return;
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await mapService.update(id, {
        title: title.trim(),
        description: description.trim() || null,
        goal: goal.trim() || null,
        tags,
        due_date: dueDate.trim() || null,
      });
      setMap(updated);
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [id, mode, title, description, goal, tags, dueDate]);

  useEffect(() => {
    if (mode !== 'edit') return;
    if (!initialLoadDone.current) return;
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      performSave();
    }, 1500);
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [title, description, goal, tags, dueDate, mode, performSave]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await mapService.create({
        title: title.trim(),
        description: description.trim() || null,
        goal: goal.trim() || null,
        tags,
        due_date: dueDate.trim() || null,
      });
      navigate(`/maps/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (mode === 'edit' && !map && !loading) return <div className={styles.loading}>Map not found</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={mode === 'edit' && map ? `/maps/${map.id}` : '/maps'} className={styles.backLink}>
          ← {mode === 'edit' ? 'Back to map' : 'Maps'}
        </Link>
        <div className={styles.statusBar}>
          {mode === 'edit' && (
            <span className={styles.savedStatus}>
              {saving ? 'Saving…' : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : map ? 'No changes' : ''}
            </span>
          )}
        </div>
      </header>

      <input
        className={styles.titleInput}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Map title"
        autoFocus={mode === 'new'}
      />

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>
          <span>Deadline</span>
          <input
            type="date"
            className={styles.dateInput}
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </label>
        <div className={styles.tagWrapper}>
          <TagInput tags={tags} onChange={setTags} />
        </div>
      </div>

      <label className={styles.blockLabel}>Scope (description)</label>
      <textarea
        className={styles.textarea}
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="What's in scope, and explicitly what's out. Markdown + LaTeX supported."
        rows={5}
      />

      <label className={styles.blockLabel}>Goal (definition of done)</label>
      <textarea
        className={styles.textarea}
        value={goal}
        onChange={e => setGoal(e.target.value)}
        placeholder="A checkable success criterion. 1–2 sentences."
        rows={3}
      />

      {error && <div className={styles.error}>{error}</div>}

      {mode === 'new' && (
        <div className={styles.createActions}>
          <button className={styles.createBtn} onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving ? 'Creating…' : 'Create map'}
          </button>
        </div>
      )}
    </div>
  );
}
