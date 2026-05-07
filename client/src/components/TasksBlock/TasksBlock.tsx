import { useState, useEffect, useRef, useCallback } from 'react';
import { Task, TaskState } from '../../types';
import { taskService } from '../../services/api';
import TaskItem from '../TaskItem/TaskItem';
import styles from './TasksBlock.module.css';

interface Props {
  dateCst: string;
  todayCst: string;
}

type ViewMode = 'today' | 'past' | 'future';

interface UndoSnapshot {
  taskId: string;
  prevState: TaskState;
  prevReason: string | null;
  newState: TaskState;
}

function getViewMode(dateCst: string, todayCst: string): ViewMode {
  if (dateCst === todayCst) return 'today';
  return dateCst < todayCst ? 'past' : 'future';
}

export default function TasksBlock({ dateCst, todayCst }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const viewMode = getViewMode(dateCst, todayCst);

  const loadTasks = useCallback(() => {
    setLoaded(false);
    if (viewMode === 'today') {
      taskService.listActive()
        .then(setTasks)
        .catch(() => setTasks([]))
        .finally(() => setLoaded(true));
    } else if (viewMode === 'past') {
      taskService.listByDay(dateCst)
        .then(setTasks)
        .catch(() => setTasks([]))
        .finally(() => setLoaded(true));
    } else {
      setTasks([]);
      setLoaded(true);
    }
  }, [dateCst, viewMode]);

  useEffect(() => {
    loadTasks();
    setShowAll(false);
    setAdding(false);
    setNewTitle('');
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    };
  }, [loadTasks]);

  const showUndo = (snapshot: UndoSnapshot) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoSnapshot(snapshot);
    undoTimerRef.current = setTimeout(() => {
      setUndoSnapshot(null);
      undoTimerRef.current = null;
    }, 5000);
  };

  const handleStateChange = async (task: Task, newState: TaskState, reason?: string) => {
    const snapshot: UndoSnapshot = {
      taskId: task.id,
      prevState: task.state,
      prevReason: task.state_reason,
      newState,
    };
    try {
      const updated = await taskService.setState(task.id, newState, reason);
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
      showUndo(snapshot);
    } catch { /* ignore */ }
  };

  const handleUndo = async () => {
    if (!undoSnapshot) return;
    const { taskId, prevState, prevReason } = undoSnapshot;
    try {
      const updated = await taskService.setState(taskId, prevState, prevReason || undefined);
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    } catch { /* ignore */ }
    setUndoSnapshot(null);
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const handleUpdate = async (task: Task, patch: { title?: string; notes?: string | null }) => {
    try {
      const updated = await taskService.update(task.id, patch);
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    } catch { /* ignore */ }
  };

  const handleDelete = async (task: Task) => {
    try {
      await taskService.delete(task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch { /* ignore */ }
  };

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const created = await taskService.create({ title });
      setTasks(prev => [...prev, created]);
      setNewTitle('');
      setTimeout(() => addInputRef.current?.focus(), 0);
    } catch { /* ignore */ }
  };

  const handleAddKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') {
      setAdding(false);
      setNewTitle('');
    }
  };

  const handleDragStart = (id: string) => { dragItemRef.current = id; };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragOverId !== id) setDragOverId(id);
  };
  const handleDrop = async (targetId: string) => {
    const dragId = dragItemRef.current;
    setDragOverId(null);
    dragItemRef.current = null;
    if (!dragId || dragId === targetId) return;

    const orderedIds = displayedTasks.map(t => t.id);
    const dragIdx = orderedIds.indexOf(dragId);
    const targetIdx = orderedIds.indexOf(targetId);
    if (dragIdx === -1 || targetIdx === -1) return;
    orderedIds.splice(dragIdx, 1);
    orderedIds.splice(targetIdx, 0, dragId);

    setTasks(prev => {
      const byId = new Map(prev.map(t => [t.id, t]));
      const reordered: Task[] = [];
      orderedIds.forEach(id => { const t = byId.get(id); if (t) reordered.push(t); });
      prev.forEach(t => { if (!orderedIds.includes(t.id)) reordered.push(t); });
      return reordered;
    });

    try {
      await taskService.reorder(orderedIds);
    } catch { /* ignore */ }
  };

  if (viewMode === 'future') return null;
  if (!loaded) return null;

  const isActive = (t: Task) => t.state === 'planned' || t.state === 'in_progress' || t.state === 'blocked';
  const activeTasks = tasks.filter(isActive);
  const completedToday = tasks.filter(t => !isActive(t));

  // For past view, "active" means active-on-that-day; show them by default. Show-all reveals completed-on-that-day.
  // For today view, "active" is current; show-all adds completed-today.
  const displayedTasks = showAll ? tasks : activeTasks;

  if (viewMode === 'past' && tasks.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>Tasks</span>
        {completedToday.length > 0 && (
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={showAll}
              onChange={e => setShowAll(e.target.checked)}
            />
            <span>Show {viewMode === 'past' ? 'completed' : 'completed today'} ({completedToday.length})</span>
          </label>
        )}
      </div>

      <div className={styles.list}>
        {displayedTasks.length === 0 ? (
          <div className={styles.empty}>
            {viewMode === 'today' ? 'No active tasks. Add one below.' : 'No tasks for this day.'}
          </div>
        ) : (
          displayedTasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              todayCst={todayCst}
              onChange={patch => handleUpdate(task, patch)}
              onStateChange={(s, r) => handleStateChange(task, s, r)}
              onDelete={() => handleDelete(task)}
              onDragStart={() => handleDragStart(task.id)}
              onDragOver={e => handleDragOver(e, task.id)}
              onDrop={() => handleDrop(task.id)}
              isDragOver={dragOverId === task.id}
            />
          ))
        )}
      </div>

      {viewMode === 'today' && (
        adding ? (
          <div className={styles.addForm}>
            <input
              ref={addInputRef}
              className={styles.addInput}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={handleAddKey}
              placeholder="Task title — Enter to add, Esc to dismiss"
              autoFocus
            />
            <button type="button" className={styles.cancelBtn} onClick={() => { setAdding(false); setNewTitle(''); }}>
              Done
            </button>
          </div>
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setAdding(true)}>
            + Add task
          </button>
        )
      )}

      {undoSnapshot && (
        <div className={styles.toast} role="status">
          <span>State changed.</span>
          <button type="button" className={styles.undoBtn} onClick={handleUndo}>Undo</button>
        </div>
      )}
    </div>
  );
}
