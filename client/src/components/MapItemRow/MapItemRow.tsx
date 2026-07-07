import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapItem, MapItemStatus } from '../../types';
import { MapItemUpdateInput, LinkLiveStatus } from '../../services/api';
import CrossAppLinkPicker from '../CrossAppLinkPicker/CrossAppLinkPicker';
import MarkdownLatex from '../MarkdownLatex/MarkdownLatex';
import styles from './MapItemRow.module.css';

interface Props {
  item: MapItem;
  liveStatus?: LinkLiveStatus;
  onChange: (patch: MapItemUpdateInput) => void;
  onDelete: () => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  isDragOver?: boolean;
}

const STATUS_CYCLE: MapItemStatus[] = ['todo', 'doing', 'done'];

function internalPath(refType: string, refId: string): string {
  if (refType === 'document') return `/library/${refId}`;
  if (refType === 'map') return `/maps/${refId}`;
  return `/entries/${refId}`;
}

export default function MapItemRow({
  item,
  liveStatus,
  onChange,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(item.notes ?? '');
  const [notesOpen, setNotesOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTitleDraft(item.title); }, [item.title]);
  useEffect(() => { setNotesDraft(item.notes ?? ''); }, [item.notes]);

  const cycleStatus = () => {
    if (item.item_status === 'skipped') { onChange({ item_status: 'todo' }); return; }
    const idx = STATUS_CYCLE.indexOf(item.item_status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    onChange({ item_status: next });
  };

  const toggleSkip = () => {
    onChange({ item_status: item.item_status === 'skipped' ? 'todo' : 'skipped' });
  };

  const startTitleEdit = () => {
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== item.title) onChange({ title: trimmed });
    if (!trimmed) setTitleDraft(item.title);
    setEditingTitle(false);
  };

  const commitNotes = () => {
    const next = notesDraft.trim() ? notesDraft : null;
    if (next !== (item.notes ?? null)) onChange({ notes: next });
    setEditingNotes(false);
  };

  const isDone = item.item_status === 'done';
  const isSkipped = item.item_status === 'skipped';
  const titleClass = `${styles.title} ${isDone || isSkipped ? styles.titleStruck : ''}`;

  const link = item.link;

  return (
    <div
      className={`${styles.item} ${isDragOver ? styles.dragOver : ''}`}
      draggable={!editingTitle && !editingNotes}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className={styles.row}>
        <span className={styles.dragHandle} title="Drag to reorder">&#8942;&#8942;</span>

        <button
          type="button"
          className={`${styles.statusPill} ${styles[`status_${item.item_status}`]}`}
          onClick={cycleStatus}
          title="Cycle status (todo → doing → done)"
        >
          {item.item_status}
        </button>

        {editingTitle ? (
          <input
            ref={titleInputRef}
            className={styles.titleInput}
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.currentTarget.blur(); }
              if (e.key === 'Escape') { setTitleDraft(item.title); setEditingTitle(false); }
            }}
          />
        ) : (
          <span className={titleClass} onClick={startTitleEdit}>{item.title}</span>
        )}

        {link ? (
          <span className={styles.linkChip} title={`${link.app}:${link.ref_type}:${link.ref_id}`}>
            {liveStatus && (
              <span className={`${styles.liveDot} ${styles[`live_${liveStatus}`]}`} title={liveStatus} />
            )}
            <span className={styles.linkApp}>{link.app}</span>
            {link.app === 'granary' ? (
              <Link className={styles.linkLabel} to={internalPath(link.ref_type, link.ref_id)} onClick={e => e.stopPropagation()}>
                {link.label || link.ref_id}
              </Link>
            ) : (
              <span className={styles.linkLabel}>{link.label || link.ref_id}</span>
            )}
            <button
              type="button"
              className={styles.linkRemove}
              onClick={() => onChange({ link: null })}
              title="Remove link"
            >
              &times;
            </button>
          </span>
        ) : (
          <button type="button" className={styles.addLinkBtn} onClick={() => setPickerOpen(true)}>
            + link
          </button>
        )}

        <button
          type="button"
          className={`${styles.notesToggle} ${notesOpen ? styles.notesToggleOpen : ''}`}
          onClick={() => setNotesOpen(o => !o)}
          title={notesOpen ? 'Hide notes' : 'Show notes'}
          aria-expanded={notesOpen}
        >
          &#8964;
        </button>

        <button
          type="button"
          className={styles.skipBtn}
          onClick={toggleSkip}
          title={isSkipped ? 'Un-skip' : 'Skip'}
        >
          {isSkipped ? '↺' : '⊘'}
        </button>

        <button type="button" className={styles.deleteBtn} onClick={onDelete} title="Delete item">
          &times;
        </button>
      </div>

      {notesOpen && (
        <div className={styles.notesArea}>
          {editingNotes ? (
            <textarea
              className={styles.notesTextarea}
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              onBlur={commitNotes}
              placeholder="Add notes (Markdown + LaTeX)…"
              rows={Math.max(2, notesDraft.split('\n').length)}
              autoFocus
            />
          ) : (
            <div className={styles.notesContent} onClick={() => setEditingNotes(true)}>
              {item.notes ? (
                <MarkdownLatex content={item.notes} />
              ) : (
                <span className={styles.notesPlaceholder}>Click to add notes…</span>
              )}
            </div>
          )}
        </div>
      )}

      {pickerOpen && (
        <CrossAppLinkPicker
          onPick={l => onChange({ link: l })}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
