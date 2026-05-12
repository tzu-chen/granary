import { useEffect, useState } from 'react';
import { documentService } from '../../services/api';
import { DocumentFilters as Filters } from '../../types';
import styles from './DocumentFilters.module.css';

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export default function DocumentFilters({ filters, onChange }: Props) {
  const [availableTags, setAvailableTags] = useState<{ tag: string; count: number }[]>([]);

  useEffect(() => {
    documentService.stats()
      .then(s => setAvailableTags(s.by_tag))
      .catch(() => setAvailableTags([]));
  }, [filters.search]);

  const setField = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleTag = (tag: string) => {
    setField('tag', filters.tag === tag ? undefined : tag);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        <input
          className={styles.input}
          placeholder="Source"
          value={filters.source || ''}
          onChange={e => setField('source', e.target.value || undefined)}
        />
        <input
          className={styles.input}
          type="date"
          value={filters.start || ''}
          onChange={e => setField('start', e.target.value || undefined)}
          title="Updated on or after"
        />
        <input
          className={styles.input}
          type="date"
          value={filters.end || ''}
          onChange={e => setField('end', e.target.value || undefined)}
          title="Updated on or before"
        />
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={filters.has_open_todos === true}
            onChange={e => setField('has_open_todos', e.target.checked ? true : undefined)}
          />
          Has open TODOs
        </label>
        {(filters.tag || filters.source || filters.start || filters.end || filters.has_open_todos !== undefined) && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => onChange({ search: filters.search })}
          >
            Clear filters
          </button>
        )}
      </div>
      {availableTags.length > 0 && (
        <div className={styles.tagRow}>
          {availableTags.map(t => (
            <button
              key={t.tag}
              type="button"
              className={`${styles.tagChip} ${filters.tag === t.tag ? styles.tagChipActive : ''}`}
              onClick={() => toggleTag(t.tag)}
            >
              {t.tag} <span className={styles.tagCount}>{t.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
