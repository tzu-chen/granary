import { useState } from 'react';
import { CROSS_APP_OPTIONS } from '../../types';
import styles from './CrossAppLinkPicker.module.css';

interface Props {
  onInsert?: (syntax: string) => void;
  onPick?: (link: { app: string; ref_type: string; ref_id: string; label?: string }) => void;
  onClose: () => void;
}

export default function CrossAppLinkPicker({ onInsert, onPick, onClose }: Props) {
  const [app, setApp] = useState<string>('granary');
  const [refType, setRefType] = useState<string>(CROSS_APP_OPTIONS[0].refTypes[0].value);
  const [refId, setRefId] = useState('');
  const [label, setLabel] = useState('');

  const appConfig = CROSS_APP_OPTIONS.find(o => o.app === app)!;

  const handleAppChange = (newApp: string) => {
    setApp(newApp);
    const cfg = CROSS_APP_OPTIONS.find(o => o.app === newApp)!;
    setRefType(cfg.refTypes[0].value);
  };

  const handleInsert = () => {
    if (!refId.trim()) return;
    if (onPick) {
      onPick({
        app,
        ref_type: refType,
        ref_id: refId.trim(),
        label: label.trim() || undefined,
      });
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
          Paste the target's ID and a human-readable label. The label is baked in at insert time.
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
          <select className={styles.select} value={refType} onChange={e => setRefType(e.target.value)}>
            {appConfig.refTypes.map(rt => (
              <option key={rt.value} value={rt.value}>{rt.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>ID</label>
          <input
            className={styles.input}
            value={refId}
            onChange={e => setRefId(e.target.value)}
            placeholder="e.g. 2301.12345 or a UUID"
            autoFocus
          />
        </div>

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
