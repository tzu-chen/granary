import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { mapService, MapUpdateInput, LinkLiveStatus } from '../../services/api';
import {
  MapRecord, MapItem, MapItemLink, MapKind, MapStatus,
  MAP_STATUSES, MAP_KINDS,
} from '../../types';
import DocumentRenderer from '../../components/DocumentRenderer/DocumentRenderer';
import MapItemRow from '../../components/MapItemRow/MapItemRow';
import CrossAppLinkPicker from '../../components/CrossAppLinkPicker/CrossAppLinkPicker';
import styles from './MapDetailPage.module.css';

// Concatenate item ids grouped by kind (fixed order), preserving each kind's
// relative order — this is the map-global position order we persist.
function groupedOrder(items: MapItem[]): string[] {
  const ids: string[] = [];
  for (const k of MAP_KINDS) {
    items.filter(i => i.kind === k.value).forEach(i => ids.push(i.id));
  }
  return ids;
}

export default function MapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [map, setMap] = useState<MapRecord | null>(null);
  const [items, setItems] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, LinkLiveStatus>>({});

  const [goalDraft, setGoalDraft] = useState('');
  const [reasonDraft, setReasonDraft] = useState('');
  const [progressDraft, setProgressDraft] = useState('');
  const [showOriginalGoal, setShowOriginalGoal] = useState(false);

  // Add-item form
  const [newKind, setNewKind] = useState<MapKind>('reading');
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newLink, setNewLink] = useState<MapItemLink | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);

  const applyMap = useCallback((m: MapRecord & { items?: MapItem[] }) => {
    setMap(m);
    if (m.items) setItems(m.items);
    setGoalDraft(m.goal || '');
    setReasonDraft(m.status_reason || '');
    setProgressDraft(m.progress_pct != null ? String(m.progress_pct) : '');
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    mapService.get(id)
      .then(m => applyMap(m))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load map'))
      .finally(() => setLoading(false));
  }, [id, applyMap]);

  // Best-effort link liveness — fire-and-forget, never block rendering.
  useEffect(() => {
    if (!id) return;
    mapService.resolveLinks(id)
      .then(results => {
        const next: Record<string, LinkLiveStatus> = {};
        results.forEach(r => { next[r.item_id] = r.status; });
        setLiveStatuses(next);
      })
      .catch(() => { /* ignore */ });
  }, [id, items.length]);

  const patchMap = useCallback(async (patch: MapUpdateInput) => {
    if (!id) return;
    try {
      const updated = await mapService.update(id, patch);
      applyMap(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }, [id, applyMap]);

  const handleDelete = async () => {
    if (!id || !map) return;
    if (!confirm(`Delete "${map.title}"? This cannot be undone.`)) return;
    await mapService.delete(id);
    navigate('/maps');
  };

  const handleStatusChange = (status: MapStatus) => {
    patchMap({ status });
  };

  const commitProgress = () => {
    const raw = progressDraft.trim();
    if (!raw) return;
    let n = parseInt(raw, 10);
    if (Number.isNaN(n)) { setProgressDraft(map?.progress_pct != null ? String(map.progress_pct) : ''); return; }
    n = Math.max(0, Math.min(100, n));
    if (n !== map?.progress_pct) patchMap({ progress_pct: n });
    else setProgressDraft(String(n));
  };

  const clearProgress = () => {
    setProgressDraft('');
    patchMap({ progress_pct: null });
  };

  const commitGoal = () => {
    const next = goalDraft.trim() ? goalDraft.trim() : null;
    if (next !== (map?.goal ?? null)) patchMap({ goal: next });
  };

  const commitReason = () => {
    const next = reasonDraft.trim() ? reasonDraft.trim() : null;
    if (next !== (map?.status_reason ?? null)) patchMap({ status_reason: next });
  };

  // -- Item handlers --
  const handleItemChange = async (item: MapItem, patch: Parameters<typeof mapService.updateItem>[2]) => {
    if (!id) return;
    try {
      const updated = await mapService.updateItem(id, item.id, patch);
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    } catch { /* ignore */ }
  };

  const handleItemDelete = async (item: MapItem) => {
    if (!id) return;
    try {
      await mapService.deleteItem(id, item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch { /* ignore */ }
  };

  const handleAddItem = async () => {
    if (!id) return;
    const title = newTitle.trim();
    if (!title) return;
    try {
      const created = await mapService.createItem(id, {
        kind: newKind,
        title,
        notes: newNotes.trim() || undefined,
        link: newLink || undefined,
      });
      setItems(prev => [...prev, created]);
      setNewTitle('');
      setNewNotes('');
      setNewLink(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add item');
    }
  };

  const handleDragStart = (itemId: string) => { dragItemRef.current = itemId; };
  const handleDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    if (dragOverId !== itemId) setDragOverId(itemId);
  };
  const handleDrop = async (targetId: string) => {
    const dragId = dragItemRef.current;
    setDragOverId(null);
    dragItemRef.current = null;
    if (!dragId || dragId === targetId || !id) return;

    const drag = items.find(i => i.id === dragId);
    const target = items.find(i => i.id === targetId);
    // Only reorder within the same kind (items are grouped by kind in the UI).
    if (!drag || !target || drag.kind !== target.kind) return;

    const arr = [...items];
    const di = arr.findIndex(i => i.id === dragId);
    arr.splice(di, 1);
    const ti = arr.findIndex(i => i.id === targetId);
    arr.splice(ti, 0, drag);
    setItems(arr);

    try {
      await mapService.reorderItems(id, groupedOrder(arr));
    } catch { /* ignore */ }
  };

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!map) return <div className={styles.loading}>Map not found</div>;

  const goalDrifted = !!map.goal_original && map.goal_original !== (map.goal || '');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <Link to="/maps" className={styles.backLink}>← Maps</Link>
          <h1 className={styles.title}>{map.title}</h1>
        </div>
        <div className={styles.actions}>
          <Link to={`/maps/${map.id}/edit`} className={styles.btn}>Edit</Link>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDelete}>Delete</button>
        </div>
      </header>

      <div className={styles.controls}>
        <label className={styles.control}>
          <span className={styles.controlLabel}>Status</span>
          <select
            className={styles.select}
            value={map.status}
            onChange={e => handleStatusChange(e.target.value as MapStatus)}
          >
            {MAP_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        <label className={styles.control}>
          <span className={styles.controlLabel}>Progress</span>
          <div className={styles.progressControl}>
            <input
              type="number"
              min={0}
              max={100}
              className={styles.progressInput}
              value={progressDraft}
              placeholder="—"
              onChange={e => setProgressDraft(e.target.value)}
              onBlur={commitProgress}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span className={styles.pctSign}>%</span>
            {map.progress_pct != null && (
              <button type="button" className={styles.clearBtn} onClick={clearProgress} title="Clear progress">
                &times;
              </button>
            )}
          </div>
        </label>

        <label className={styles.control}>
          <span className={styles.controlLabel}>Deadline</span>
          <input
            type="date"
            className={styles.dateInput}
            value={map.due_date || ''}
            onChange={e => patchMap({ due_date: e.target.value || null })}
          />
        </label>

        {map.tags.length > 0 && (
          <div className={styles.tags}>
            {map.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
          </div>
        )}
      </div>

      {map.status === 'abandoned' && (
        <input
          className={styles.reasonInput}
          value={reasonDraft}
          onChange={e => setReasonDraft(e.target.value)}
          onBlur={commitReason}
          placeholder="Reason for abandoning (optional)"
        />
      )}

      {map.progress_pct != null && (
        <div className={styles.progressBarRow}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${map.progress_pct}%` }} />
          </div>
          <span className={styles.progressBarLabel}>{map.progress_pct}%</span>
        </div>
      )}

      {map.description && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Scope</h2>
          <DocumentRenderer content={map.description} className={styles.scopeBody} />
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Goal</h2>
        <textarea
          className={styles.goalTextarea}
          value={goalDraft}
          onChange={e => setGoalDraft(e.target.value)}
          onBlur={commitGoal}
          placeholder="A checkable definition of done…"
          rows={2}
        />
        {goalDrifted && (
          <div className={styles.originalGoal}>
            <button type="button" className={styles.disclosureBtn} onClick={() => setShowOriginalGoal(o => !o)}>
              {showOriginalGoal ? '▾' : '▸'} Original goal
            </button>
            {showOriginalGoal && <p className={styles.originalGoalText}>{map.goal_original}</p>}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Items</h2>
        {items.length === 0 ? (
          <p className={styles.empty}>No items yet. Add one below.</p>
        ) : (
          MAP_KINDS.map(kind => {
            const kindItems = items.filter(i => i.kind === kind.value);
            if (kindItems.length === 0) return null;
            return (
              <div key={kind.value} className={styles.kindGroup}>
                <h3 className={styles.kindTitle}>{kind.label}</h3>
                <div className={styles.itemList}>
                  {kindItems.map(item => (
                    <MapItemRow
                      key={item.id}
                      item={item}
                      liveStatus={liveStatuses[item.id]}
                      onChange={patch => handleItemChange(item, patch)}
                      onDelete={() => handleItemDelete(item)}
                      onDragStart={() => handleDragStart(item.id)}
                      onDragOver={e => handleDragOver(e, item.id)}
                      onDrop={() => handleDrop(item.id)}
                      isDragOver={dragOverId === item.id}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}

        <div className={styles.addForm}>
          <div className={styles.addRow}>
            <select
              className={styles.kindSelect}
              value={newKind}
              onChange={e => setNewKind(e.target.value as MapKind)}
            >
              {MAP_KINDS.map(k => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
            <input
              className={styles.addTitle}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddItem(); } }}
              placeholder="Item title (required)"
            />
            <button type="button" className={styles.addLinkBtn} onClick={() => setPickerOpen(true)}>
              {newLink ? 'Change link' : '+ link'}
            </button>
            <button type="button" className={styles.addBtn} onClick={handleAddItem} disabled={!newTitle.trim()}>
              Add
            </button>
          </div>
          {newLink && (
            <div className={styles.newLinkChip}>
              <span className={styles.newLinkApp}>{newLink.app}</span>
              <span>{newLink.label || newLink.ref_id}</span>
              <button type="button" className={styles.newLinkRemove} onClick={() => setNewLink(null)}>&times;</button>
            </div>
          )}
          <textarea
            className={styles.addNotes}
            value={newNotes}
            onChange={e => setNewNotes(e.target.value)}
            placeholder="Notes (optional, Markdown + LaTeX)"
            rows={2}
          />
        </div>
      </section>

      {error && <div className={styles.error}>{error}</div>}

      {pickerOpen && (
        <CrossAppLinkPicker
          onPick={l => setNewLink(l)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
