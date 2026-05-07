import { useState, useEffect, useRef, useCallback } from 'react';
import { Task, TaskState } from '../../types';
import TaskStateTag from '../TaskStateTag/TaskStateTag';
import StaleTaskBanner from '../StaleTaskBanner/StaleTaskBanner';
import MarkdownLatex from '../MarkdownLatex/MarkdownLatex';
import styles from './TaskItem.module.css';

interface Props {
  task: Task;
  todayCst: string;
  onChange: (patch: { title?: string; notes?: string | null }) => void;
  onStateChange: (state: TaskState, reason?: string) => void;
  onDelete: () => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  isDragOver?: boolean;
}

const STALE_THRESHOLD_DAYS = 7;

function diffInDays(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00');
  const db = new Date(b + 'T12:00:00');
  return Math.floor((da.getTime() - db.getTime()) / 86400000);
}

export default function TaskItem({
  task,
  todayCst,
  onChange,
  onStateChange,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(task.notes ?? '');
  const [notesOpen, setNotesOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTitleDraft(task.title); }, [task.title]);
  useEffect(() => { setNotesDraft(task.notes ?? ''); }, [task.notes]);

  const flushTitle = useCallback(() => {
    if (titleTimer.current) {
      clearTimeout(titleTimer.current);
      titleTimer.current = null;
    }
  }, []);

  const flushNotes = useCallback(() => {
    if (notesTimer.current) {
      clearTimeout(notesTimer.current);
      notesTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => { flushTitle(); flushNotes(); };
  }, [flushTitle, flushNotes]);

  const isActive = task.state === 'planned' || task.state === 'in_progress' || task.state === 'blocked';
  const daysOpen = isActive ? diffInDays(todayCst, task.created_on) : 0;
  const showStaleBanner = isActive && daysOpen >= STALE_THRESHOLD_DAYS && !bannerDismissed;

  const handleTitleChange = (value: string) => {
    setTitleDraft(value);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed && trimmed !== task.title) onChange({ title: trimmed });
    }, 1500);
  };

  const handleTitleBlur = () => {
    flushTitle();
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== task.title) onChange({ title: trimmed });
    if (!trimmed) setTitleDraft(task.title);
    setEditingTitle(false);
  };

  const handleNotesChange = (value: string) => {
    setNotesDraft(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      const next = value.trim() ? value : null;
      if (next !== task.notes) onChange({ notes: next });
    }, 1500);
  };

  const handleNotesBlur = () => {
    flushNotes();
    const next = notesDraft.trim() ? notesDraft : null;
    if (next !== task.notes) onChange({ notes: next });
    setEditingNotes(false);
  };

  const startTitleEdit = () => {
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleRedefine = () => {
    setBannerDismissed(true);
    startTitleEdit();
  };

  const handleAbandonFromBanner = () => {
    setBannerDismissed(true);
    onStateChange('abandoned');
  };

  const isDone = task.state === 'done';
  const isAbandoned = task.state === 'abandoned';
  const titleClass = `${styles.title} ${isDone || isAbandoned ? styles.titleStruck : ''}`;

  return (
    <div
      className={`${styles.task} ${isDragOver ? styles.dragOver : ''} ${isDone ? styles.taskDone : ''} ${isAbandoned ? styles.taskAbandoned : ''}`}
      draggable={!editingTitle && !editingNotes}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {showStaleBanner && (
        <StaleTaskBanner
          daysOpen={daysOpen}
          onKeep={() => setBannerDismissed(true)}
          onRedefine={handleRedefine}
          onAbandon={handleAbandonFromBanner}
        />
      )}

      <div className={styles.row}>
        <span className={styles.dragHandle} title="Drag to reorder">&#8942;&#8942;</span>

        <TaskStateTag
          state={task.state}
          reason={task.state_reason}
          onChange={(s, r) => onStateChange(s, r)}
        />

        {editingTitle ? (
          <input
            ref={titleInputRef}
            className={styles.titleInput}
            value={titleDraft}
            onChange={e => handleTitleChange(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.currentTarget.blur(); }
              if (e.key === 'Escape') { setTitleDraft(task.title); setEditingTitle(false); }
            }}
          />
        ) : (
          <span className={titleClass} onClick={startTitleEdit} title={task.state_reason ?? undefined}>
            {task.title}
          </span>
        )}

        {task.state_reason && (
          <span className={styles.reasonChip} title={task.state_reason}>
            {task.state_reason}
          </span>
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
          className={styles.deleteBtn}
          onClick={onDelete}
          title="Delete task"
        >
          &times;
        </button>
      </div>

      {notesOpen && (
        <div className={styles.notesArea}>
          {editingNotes ? (
            <textarea
              className={styles.notesTextarea}
              value={notesDraft}
              onChange={e => handleNotesChange(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes (Markdown + LaTeX)..."
              rows={Math.max(2, notesDraft.split('\n').length)}
              autoFocus
            />
          ) : (
            <div
              className={styles.notesContent}
              onClick={() => setEditingNotes(true)}
            >
              {task.notes ? (
                <MarkdownLatex content={task.notes} />
              ) : (
                <span className={styles.notesPlaceholder}>Click to add notes…</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
