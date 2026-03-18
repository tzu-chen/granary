import { useState, useEffect, useRef, useCallback } from 'react';
import { daySummaryService } from '../../services/api';
import styles from './DaySummary.module.css';

interface Props {
  dateCst: string;
}

export default function DaySummary({ dateCst }: Props) {
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLoaded(false);
    daySummaryService.get(dateCst)
      .then(s => setContent(s.content))
      .catch(() => setContent(''));
    setLoaded(true);
  }, [dateCst]);

  const save = useCallback((value: string) => {
    daySummaryService.save(dateCst, value).catch(() => {});
  }, [dateCst]);

  const handleChange = (value: string) => {
    setContent(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(value), 1500);
  };

  if (!loaded) return null;

  return (
    <div className={styles.container}>
      <textarea
        className={styles.textarea}
        value={content}
        onChange={e => handleChange(e.target.value)}
        placeholder="Day summary — goals, reflections, open questions..."
        rows={2}
      />
    </div>
  );
}
