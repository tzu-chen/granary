import { useState, useEffect } from 'react';
import { EntryType, EntryPriority, ENTRY_TYPES, PRIORITY_OPTIONS } from '../../types';
import TagInput from '../TagInput/TagInput';
import SourceInput from '../SourceInput/SourceInput';
import styles from './EntryForm.module.css';

export interface EntryFormData {
  content: string;
  entry_type: EntryType;
  tags: string[];
  source: string;
  priority?: EntryPriority;
}

interface Props {
  initial?: EntryFormData;
  onSubmit: (data: EntryFormData) => void;
  submitLabel?: string;
}

export default function EntryForm({ initial, onSubmit, submitLabel = 'Add Entry' }: Props) {
  const [content, setContent] = useState(initial?.content || '');
  const [entryType, setEntryType] = useState<EntryType>(initial?.entry_type || 'note');
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [source, setSource] = useState(initial?.source || '');
  const [priority, setPriority] = useState<EntryPriority>(initial?.priority ?? null);

  const showPriority = entryType === 'question';

  useEffect(() => {
    if (showPriority && priority === null) {
      setPriority('medium');
    } else if (!showPriority) {
      setPriority(null);
    }
  }, [entryType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit({ content, entry_type: entryType, tags, source, priority: showPriority ? priority : null });
    if (!initial) {
      setContent('');
      setTags([]);
      setSource('');
      setPriority(null);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <textarea
        className={styles.textarea}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="What did you learn? (Markdown + LaTeX supported)"
        rows={4}
      />
      <div className={styles.row}>
        <select
          className={styles.select}
          value={entryType}
          onChange={e => setEntryType(e.target.value as EntryType)}
        >
          {ENTRY_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {showPriority && (
          <select
            className={styles.select}
            value={priority || 'medium'}
            onChange={e => setPriority(e.target.value as NonNullable<EntryPriority>)}
          >
            {PRIORITY_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label} Priority</option>
            ))}
          </select>
        )}
        <SourceInput value={source} onChange={setSource} placeholder="Reference" />
        <TagInput tags={tags} onChange={setTags} />
      </div>
      <button className={styles.submit} type="submit" disabled={!content.trim()}>
        {submitLabel}
      </button>
    </form>
  );
}
