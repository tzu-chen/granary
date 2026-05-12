import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { documentService } from '../../services/api';
import TagInput from '../../components/TagInput/TagInput';
import DocumentEditor from '../../components/DocumentEditor/DocumentEditor';
import { Document } from '../../types';
import styles from './DocumentEditPage.module.css';

interface Props {
  mode: 'new' | 'edit';
}

export default function DocumentEditPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<Document | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    documentService.get(id)
      .then(d => {
        setDoc(d);
        setTitle(d.title);
        setContent(d.content);
        setTags(d.tags);
        setSource(d.source || '');
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
      const updated = await documentService.update(id, {
        title: title.trim(),
        content,
        tags,
        source: source.trim() || null,
      });
      setDoc(updated);
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [id, mode, title, content, tags, source]);

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
  }, [title, content, tags, source, mode, performSave]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await documentService.create({
        title: title.trim(),
        content,
        tags,
        source: source.trim() || null,
      });
      navigate(`/library/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (mode === 'edit' && !doc && !loading) return <div className={styles.loading}>Document not found</div>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={mode === 'edit' && doc ? `/library/${doc.id}` : '/library'} className={styles.backLink}>
          ← {mode === 'edit' ? 'Back to document' : 'Library'}
        </Link>
        <div className={styles.statusBar}>
          {mode === 'edit' && (
            <span className={styles.savedStatus}>
              {saving ? 'Saving…' : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : doc ? 'No changes' : ''}
            </span>
          )}
        </div>
      </header>

      <input
        className={styles.titleInput}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title"
        autoFocus={mode === 'new'}
      />

      <div className={styles.fieldRow}>
        <input
          className={styles.sourceInput}
          value={source}
          onChange={e => setSource(e.target.value)}
          placeholder="Source (optional)"
        />
        <div className={styles.tagWrapper}>
          <TagInput tags={tags} onChange={setTags} />
        </div>
      </div>

      <DocumentEditor value={content} onChange={setContent} />

      {error && <div className={styles.error}>{error}</div>}

      {mode === 'new' && (
        <div className={styles.createActions}>
          <button className={styles.createBtn} onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving ? 'Creating…' : 'Create document'}
          </button>
        </div>
      )}
    </div>
  );
}
