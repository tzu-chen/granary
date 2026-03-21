import { useState, useEffect, useRef } from 'react';
import { scribeService, sourceService } from '../../services/api';
import { ScribeBook } from '../../types';
import styles from './SourceInput.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface Suggestion {
  label: string;
  subtitle?: string;
  section: 'books' | 'sources';
}

export default function SourceInput({ value, onChange, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [localSources, setLocalSources] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sourceService.list().then(rows => setLocalSources(rows.map(r => r.source))).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const q = query.trim().toLowerCase();
      const results: Suggestion[] = [];

      // Fetch Scribe books
      try {
        const books: ScribeBook[] = await scribeService.searchBooks(query.trim());
        for (const book of books) {
          results.push({
            label: book.filename,
            subtitle: book.subject || undefined,
            section: 'books',
          });
        }
      } catch {
        // Scribe unavailable — skip
      }

      // Filter local sources
      const localMatches = localSources
        .filter(s => s.toLowerCase().includes(q) && !results.some(r => r.label === s))
        .slice(0, 5);
      for (const s of localMatches) {
        results.push({ label: s, section: 'sources' });
      }

      setSuggestions(results);
      setHighlightIndex(-1);
      setShowDropdown(results.length > 0);
    }, 300);
  };

  const handleChange = (newValue: string) => {
    onChange(newValue);
    search(newValue);
  };

  const selectSuggestion = (suggestion: Suggestion) => {
    onChange(suggestion.label);
    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const bookSuggestions = suggestions.filter(s => s.section === 'books');
  const sourceSuggestions = suggestions.filter(s => s.section === 'sources');

  let globalIndex = -1;

  return (
    <div className={styles.container} ref={containerRef}>
      <input
        className={styles.input}
        type="text"
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
        placeholder={placeholder}
      />
      {showDropdown && suggestions.length > 0 && (
        <div className={styles.suggestions}>
          {bookSuggestions.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Books</div>
              {bookSuggestions.map(s => {
                globalIndex++;
                const idx = globalIndex;
                return (
                  <button
                    key={`book-${s.label}`}
                    className={`${styles.suggestion} ${idx === highlightIndex ? styles.highlighted : ''}`}
                    onMouseDown={() => selectSuggestion(s)}
                    type="button"
                  >
                    {s.label}
                    {s.subtitle && <span className={styles.suggestionSubject}>{s.subtitle}</span>}
                  </button>
                );
              })}
            </>
          )}
          {sourceSuggestions.length > 0 && (
            <>
              <div className={styles.sectionLabel}>Recent sources</div>
              {sourceSuggestions.map(s => {
                globalIndex++;
                const idx = globalIndex;
                return (
                  <button
                    key={`source-${s.label}`}
                    className={`${styles.suggestion} ${idx === highlightIndex ? styles.highlighted : ''}`}
                    onMouseDown={() => selectSuggestion(s)}
                    type="button"
                  >
                    {s.label}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
