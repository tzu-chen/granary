import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapItem, MapItemLink, MapItemStatus } from '../../types';
import { MapItemUpdateInput, LinkLiveStatus, InteropBaseUrls } from '../../services/api';
import CrossAppLinkPicker from '../CrossAppLinkPicker/CrossAppLinkPicker';
import MarkdownLatex from '../MarkdownLatex/MarkdownLatex';
import { GripIcon, TrashIcon, ExternalLinkIcon } from '../Icons/Icons';
import styles from './MapItemRow.module.css';

interface Props {
  item: MapItem;
  liveStatus?: LinkLiveStatus;
  bases?: InteropBaseUrls | null;
  onChange: (patch: MapItemUpdateInput) => void;
  onDelete: () => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  isDragOver?: boolean;
}

const STATUS_CYCLE: MapItemStatus[] = ['todo', 'doing', 'done'];
const STATUS_TITLE: Record<MapItemStatus, string> = {
  todo: 'To do — click to start',
  doing: 'In progress — click to finish',
  done: 'Done — click to reset',
  skipped: 'Skipped — click to restore',
};

function internalPath(refType: string, refId: string): string {
  if (refType === 'document') return `/library/${refId}`;
  if (refType === 'map') return `/maps/${refId}`;
  return `/entries/${refId}`;
}

// Where a linked item's "jump" affordance should go. Granary refs navigate
// internally; Pyramid sessions deep-link to the session; the other siblings
// have no per-record route, so we open the app itself (best available).
function jumpTarget(
  link: MapItemLink,
  bases?: InteropBaseUrls | null,
): { internal: string } | { external: string } | null {
  if (link.app === 'granary') return { internal: internalPath(link.ref_type, link.ref_id) };
  const base = bases ? bases[link.app as keyof InteropBaseUrls] : null;
  if (!base) return null;
  if (link.app === 'pyramid' && link.ref_type === 'session_id') {
    return { external: `${base}/sessions/${encodeURIComponent(link.ref_id)}` };
  }
  return { external: base };
}

export default function MapItemRow({
  item,
  liveStatus,
  bases,
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
  const hasNotes = !!item.notes;

  const link = item.link;
  const jump = link ? jumpTarget(link, bases) : null;
  const appName = link ? link.app.charAt(0).toUpperCase() + link.app.slice(1) : '';

  return (
    <div
      className={`${styles.item} ${isDragOver ? styles.dragOver : ''} ${isDone ? styles.itemDone : ''}`}
      draggable={!editingTitle && !editingNotes}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className={styles.row}>
        <span className={styles.dragHandle} title="Drag to reorder"><GripIcon size={14} /></span>

        <button
          type="button"
          className={`${styles.statusBox} ${styles[`box_${item.item_status}`]}`}
          onClick={cycleStatus}
          title={STATUS_TITLE[item.item_status]}
          aria-label={STATUS_TITLE[item.item_status]}
        />

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
          <span className={titleClass} onClick={startTitleEdit} title={item.title}>{item.title}</span>
        )}

        {link ? (
          <span className={styles.linkChip} title={`${link.app}:${link.ref_type}:${link.ref_id}`}>
            {liveStatus && (
              <span className={`${styles.liveDot} ${styles[`live_${liveStatus}`]}`} title={liveStatus} />
            )}
            <span className={styles.linkApp}>{link.app}</span>
            <span className={styles.linkLabel}>{link.label || link.ref_id}</span>
            {jump && ('internal' in jump ? (
              <Link
                className={styles.jumpBtn}
                to={jump.internal}
                title={`Open in ${appName}`}
                onClick={e => e.stopPropagation()}
              >
                <ExternalLinkIcon size={12} />
              </Link>
            ) : (
              <a
                className={styles.jumpBtn}
                href={jump.external}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open in ${appName}`}
                onClick={e => e.stopPropagation()}
              >
                <ExternalLinkIcon size={12} />
              </a>
            ))}
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

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.notesToggle} ${notesOpen ? styles.notesToggleOpen : ''} ${hasNotes ? styles.notesToggleFilled : ''}`}
            onClick={() => setNotesOpen(o => !o)}
            title={notesOpen ? 'Hide notes' : hasNotes ? 'Show notes' : 'Add notes'}
            aria-expanded={notesOpen}
          >
            &#8964;
          </button>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggleSkip}
            title={isSkipped ? 'Un-skip' : 'Skip'}
          >
            {isSkipped ? '↺' : '⊘'}
          </button>

          <button type="button" className={`${styles.iconBtn} ${styles.deleteBtn}`} onClick={onDelete} title="Delete item">
            <TrashIcon size={14} />
          </button>
        </div>
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
