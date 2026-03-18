import { useState, useEffect } from 'react';
import { tagService } from '../../services/api';
import styles from './TagInput.module.css';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagInput({ tags, onChange }: Props) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    tagService.list().then(result => setAllTags(result.map(t => t.tag))).catch(() => {});
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      const tag = input.trim().toLowerCase();
      if (!tags.includes(tag)) {
        onChange([...tags, tag]);
      }
      setInput('');
      setSuggestions([]);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleChange = (value: string) => {
    setInput(value);
    if (value.trim()) {
      const filtered = allTags.filter(t =>
        t.toLowerCase().includes(value.toLowerCase()) && !tags.includes(t)
      );
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const addTag = (tag: string) => {
    if (!tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput('');
    setSuggestions([]);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div className={styles.container}>
      <div className={styles.tagList}>
        {tags.map(tag => (
          <span key={tag} className={styles.tag}>
            {tag}
            <button className={styles.removeBtn} onClick={() => removeTag(tag)} type="button">&times;</button>
          </span>
        ))}
        <input
          className={styles.input}
          value={input}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? 'Add tags...' : ''}
        />
      </div>
      {suggestions.length > 0 && (
        <div className={styles.suggestions}>
          {suggestions.map(s => (
            <button key={s} className={styles.suggestion} onClick={() => addTag(s)} type="button">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
