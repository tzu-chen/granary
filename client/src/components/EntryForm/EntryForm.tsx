import { useState } from 'react';
import { EntryType, ENTRY_TYPES } from '../../types';
import TagInput from '../TagInput/TagInput';
import styles from './EntryForm.module.css';

interface EntryFormData {
  content: string;
  entry_type: EntryType;
  tags: string[];
  source: string;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit({ content, entry_type: entryType, tags, source });
    if (!initial) {
      setContent('');
      setTags([]);
      setSource('');
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
        <input
          className={styles.input}
          type="text"
          value={source}
          onChange={e => setSource(e.target.value)}
          placeholder="Source (e.g., Brezis Ch.4)"
        />
      </div>
      <TagInput tags={tags} onChange={setTags} />
      <button className={styles.submit} type="submit" disabled={!content.trim()}>
        {submitLabel}
      </button>
    </form>
  );
}
