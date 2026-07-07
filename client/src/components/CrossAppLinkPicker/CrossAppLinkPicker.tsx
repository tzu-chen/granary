import { useEffect, useRef, useState } from 'react';
import { CROSS_APP_OPTIONS } from '../../types';
import { interopService, InteropSuggestion } from '../../services/api';
import styles from './CrossAppLinkPicker.module.css';

interface Props {
  onInsert?: (syntax: string) => void;
  onPick?: (link: { app: string; ref_type: string; ref_id: string; label?: string }) => void;
  onClose: () => void;
}

export default function CrossAppLinkPicker({ onInsert, onPick, onClose }: Props) {
  const [app, setApp] = useState<string>('granary');
  const [refType, setRefType] = useState<string>(CROSS_APP_OPTIONS[0].refTypes[0].value);
  const [query, setQuery] = useState('');
  const [refId, setRefId] = useState('');
  const [label, setLabel] = useState('');
  const [picked, setPicked] = useState(false);

  const [suggestions, setSuggestions] = useState<InteropSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const reqIdRef = useRef(0);

  const appConfig = CROSS_APP_OPTIONS.find(o => o.app === app)!;

  const runSearch = (q: string, forApp: string, forType: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const reqId = ++reqIdRef.current;
      setLoading(true);
      try {
        const results = await interopService.search(forApp, forType, q);
        if (reqId !== reqIdRef.current) return; // a newer search superseded this one
        setSuggestions(results);
        setHighlight(-1);
        setShowDropdown(true);
      } catch {
        if (reqId !== reqIdRef.current) return;
        setSuggestions([]);
        setShowDropdown(true);
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    }, 250);
  };

  const handleAppChange = (newApp: string) => {
    setApp(newApp);
    const cfg = CROSS_APP_OPTIONS.find(o => o.app === newApp)!;
    const firstType = cfg.refTypes[0].value;
    setRefType(firstType);
    setQuery(''); setRefId(''); setLabel(''); setPicked(false);
    setSuggestions([]); setShowDropdown(false);
  };

  const handleTypeChange = (newType: string) => {
    setRefType(newType);
    setQuery(''); setRefId(''); setLabel(''); setPicked(false);
    setSuggestions([]); setShowDropdown(false);
  };

  const handleQueryChange = (v: string) => {
    setQuery(v);
    setRefId(v);       // raw text is the id until a suggestion is picked
    setPicked(false);
    runSearch(v, app, refType);
  };

  const selectSuggestion = (s: InteropSuggestion) => {
    setRefId(s.ref_id);
    setLabel(s.label);
    setQuery(s.label);
    setPicked(true);
    setShowDropdown(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Escape') setShowDropdown(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(p => (p + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(p => (p <= 0 ? suggestions.length - 1 : p - 1));
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlight]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleInsert = () => {
    if (!refId.trim()) return;
    if (onPick) {
      onPick({ app, ref_type: refType, ref_id: refId.trim(), label: label.trim() || undefined });
      onClose();
      return;
    }
    const syntax = label.trim()
      ? `[[${app}:${refType}:${refId.trim()}|${label.trim()}]]`
      : `[[${app}:${refType}:${refId.trim()}]]`;
    onInsert?.(syntax);
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>Insert cross-app link</h3>
        <p className={styles.hint}>
          Search live records in the target app, or paste an ID directly. The label is baked in at insert time.
        </p>

        <div className={styles.row}>
          <label className={styles.label}>App</label>
          <select className={styles.select} value={app} onChange={e => handleAppChange(e.target.value)}>
            {CROSS_APP_OPTIONS.map(opt => (
              <option key={opt.app} value={opt.app}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Type</label>
          <select className={styles.select} value={refType} onChange={e => handleTypeChange(e.target.value)}>
            {appConfig.refTypes.map(rt => (
              <option key={rt.value} value={rt.value}>{rt.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Find</label>
          <div className={styles.searchWrap}>
            <input
              className={styles.input}
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => runSearch(query, app, refType)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 120)}
              placeholder="Search by title, or paste an ID…"
              autoFocus
              autoComplete="off"
            />
            {showDropdown && (
              <div className={styles.suggestions}>
                {loading && suggestions.length === 0 && (
                  <div className={styles.suggestionEmpty}>Searching…</div>
                )}
                {!loading && suggestions.length === 0 && (
                  <div className={styles.suggestionEmpty}>No matches — paste an ID to link manually.</div>
                )}
                {suggestions.map((s, i) => (
                  <button
                    type="button"
                    key={`${s.ref_id}-${i}`}
                    className={`${styles.suggestion} ${i === highlight ? styles.highlighted : ''}`}
                    onMouseDown={() => selectSuggestion(s)}
                  >
                    <span className={styles.suggestionLabel}>{s.label}</span>
                    {s.subtitle && <span className={styles.suggestionSub}>{s.subtitle}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {picked && refId && refId !== query && (
          <div className={styles.resolvedId}>
            <span className={styles.resolvedLabel}>ID</span>
            <code>{refId}</code>
          </div>
        )}

        <div className={styles.row}>
          <label className={styles.label}>Label</label>
          <input
            className={styles.input}
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Display text (optional)"
          />
        </div>

        <div className={styles.preview}>
          <code>
            {label.trim()
              ? `[[${app}:${refType}:${refId || '<id>'}|${label}]]`
              : `[[${app}:${refType}:${refId || '<id>'}]]`}
          </code>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.insert} onClick={handleInsert} disabled={!refId.trim()}>
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
