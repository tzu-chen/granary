import { useState } from 'react';
import { Entry, EntryType, ENTRY_TYPES } from '../../types';
import TagInput from '../TagInput/TagInput';
import SourceInput from '../SourceInput/SourceInput';
import styles from './ResolveForm.module.css';

interface Props {
  entry: Entry;
  onSubmit: (data: { content: string; tags?: string[]; entry_type?: string; source?: string }) => void;
  onCancel: () => void;
}

export default function ResolveForm({ entry, onSubmit, onCancel }: Props) {
  const [content, setContent] = useState('');
  const [entryType, setEntryType] = useState<EntryType>('note');
  const [tags, setTags] = useState<string[]>(entry.tags);
  const [source, setSource] = useState(entry.source || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit({ content, tags, entry_type: entryType, source: source || undefined });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>Resolve Entry</div>
      <textarea
        className={styles.textarea}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Write your resolution (Markdown + LaTeX supported)"
        rows={4}
        autoFocus
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
        <SourceInput value={source} onChange={setSource} placeholder="Source" />
      </div>
      <TagInput tags={tags} onChange={setTags} />
      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        <button type="submit" className={styles.submitBtn} disabled={!content.trim()}>Resolve</button>
      </div>
    </form>
  );
}
