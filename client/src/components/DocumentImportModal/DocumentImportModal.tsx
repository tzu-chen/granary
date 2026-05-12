import { useState } from 'react';
import { documentService } from '../../services/api';
import { Document } from '../../types';
import styles from './DocumentImportModal.module.css';

interface Props {
  onClose: () => void;
  onImported: (docs: Document[]) => void;
}

interface QueuedFile {
  file: File;
  title: string;
}

type Tab = 'upload' | 'paste';

function deriveTitleFromContent(filename: string, content: string): string {
  const lines = content.split('\n').slice(0, 50);
  for (const raw of lines) {
    const m = raw.trim().match(/^#\s+(.+)$/);
    if (m) return m[1].trim();
  }
  return filename.replace(/\.[^.]+$/, '');
}

export default function DocumentImportModal({ onClose, onImported }: Props) {
  const [tab, setTab] = useState<Tab>('upload');
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = async (files: FileList | File[]) => {
    const added: QueuedFile[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      added.push({ file, title: deriveTitleFromContent(file.name, text) });
    }
    setQueue(q => [...q, ...added]);
  };

  const removeQueued = (index: number) => {
    setQueue(q => q.filter((_, i) => i !== index));
  };

  const updateTitle = (index: number, title: string) => {
    setQueue(q => q.map((item, i) => (i === index ? { ...item, title } : item)));
  };

  const submitUpload = async () => {
    if (queue.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const files = queue.map(q => q.file);
      const titles = queue.map(q => q.title);
      const created = await documentService.importFiles(files, titles);
      onImported(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const submitPaste = async () => {
    if (!pasteTitle.trim() || !pasteContent.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await documentService.importPaste({ title: pasteTitle.trim(), content: pasteContent });
      onImported(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'upload' ? styles.tabActive : ''}`}
            onClick={() => setTab('upload')}
          >
            Upload files
          </button>
          <button
            className={`${styles.tab} ${tab === 'paste' ? styles.tabActive : ''}`}
            onClick={() => setTab('paste')}
          >
            Paste markdown
          </button>
        </div>

        {tab === 'upload' && (
          <div className={styles.tabPanel}>
            <label className={styles.dropZone}>
              <input
                type="file"
                multiple
                accept=".md,.markdown,text/markdown,text/plain"
                onChange={e => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <span>Click to choose .md files (multiple allowed)</span>
              <span className={styles.dropHint}>
                Title is the first H1 in the file, or the filename if there is none.
              </span>
            </label>
            {queue.length > 0 && (
              <ul className={styles.queue}>
                {queue.map((item, i) => (
                  <li key={i} className={styles.queueItem}>
                    <input
                      className={styles.titleInput}
                      value={item.title}
                      onChange={e => updateTitle(i, e.target.value)}
                    />
                    <span className={styles.filename}>{item.file.name}</span>
                    <button type="button" className={styles.removeBtn} onClick={() => removeQueued(i)}>×</button>
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
              <button
                type="button"
                className={styles.submit}
                onClick={submitUpload}
                disabled={busy || queue.length === 0}
              >
                {busy ? 'Importing…' : `Import ${queue.length} ${queue.length === 1 ? 'file' : 'files'}`}
              </button>
            </div>
          </div>
        )}

        {tab === 'paste' && (
          <div className={styles.tabPanel}>
            <input
              className={styles.titleInput}
              value={pasteTitle}
              onChange={e => setPasteTitle(e.target.value)}
              placeholder="Title"
            />
            <textarea
              className={styles.pasteArea}
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
              placeholder="Paste markdown here…"
              spellCheck={false}
            />
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
              <button
                type="button"
                className={styles.submit}
                onClick={submitPaste}
                disabled={busy || !pasteTitle.trim() || !pasteContent.trim()}
              >
                {busy ? 'Creating…' : 'Create document'}
              </button>
            </div>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}
      </div>
    </div>
  );
}
