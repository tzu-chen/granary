import { useRef, useState } from 'react';
import CrossAppLinkPicker from '../CrossAppLinkPicker/CrossAppLinkPicker';
import styles from './DocumentEditor.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function DocumentEditor({ value, onChange, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Current date in CST (UTC-6 fixed offset, same convention as elsewhere), short form.
  // Braces are required for mm-dd to be styled by DocumentRenderer's date detection.
  const insertCurrentDate = () => {
    const cst = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(5, 10);
    insertAtCursor(`{${cst}}`);
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setPickerOpen(true)}
        >
          Insert link…
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={insertCurrentDate}
        >
          Insert date
        </button>
        <span className={styles.hint}>Markdown · LaTeX · {`[[app:type:id|label]]`}</span>
      </div>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Start writing… Markdown + LaTeX supported.'}
        spellCheck={false}
      />
      {pickerOpen && (
        <CrossAppLinkPicker
          onInsert={insertAtCursor}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
