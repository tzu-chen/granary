import { useState, useEffect, useRef } from 'react';
import { SummaryItem } from '../../types';
import { daySummaryService, summaryItemService } from '../../services/api';
import MarkdownLatex from '../MarkdownLatex/MarkdownLatex';
import TasksBlock from '../TasksBlock/TasksBlock';
import styles from './DaySummary.module.css';

interface Props {
  dateCst: string;
  todayCst: string;
}

export default function DaySummary({ dateCst, todayCst }: Props) {
  const [goalsArchive, setGoalsArchive] = useState<string | null>(null);
  const [progressArchive, setProgressArchive] = useState<string | null>(null);
  const [openQuestionsArchive, setOpenQuestionsArchive] = useState<string | null>(null);
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemTag, setNewItemTag] = useState('');
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);

  const itemTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isPastDay = dateCst < todayCst;
  const hasArchive = isPastDay && (!!goalsArchive || !!progressArchive || !!openQuestionsArchive);

  useEffect(() => {
    setLoaded(false);
    setEditingItemId(null);
    setShowAddItem(false);
    setArchiveExpanded(false);
    setExpandedItems(new Set());

    daySummaryService.get(dateCst).then(data => {
      setGoalsArchive(data.goals);
      setProgressArchive(data.progress);
      setOpenQuestionsArchive(data.open_questions);
      setItems(data.items || []);
      setLoaded(true);
    }).catch(() => {
      setGoalsArchive(null);
      setProgressArchive(null);
      setOpenQuestionsArchive(null);
      setItems([]);
      setLoaded(true);
    });
  }, [dateCst]);

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setEditingItemId(i => i === id ? null : i);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleItemFieldChange = (id: string, field: 'title' | 'content' | 'tag', value: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value || null } : item
    ));
    const timerKey = `${id}_${field}`;
    if (itemTimers.current[timerKey]) clearTimeout(itemTimers.current[timerKey]);
    itemTimers.current[timerKey] = setTimeout(() => {
      summaryItemService.update(dateCst, id, { [field]: value || null }).catch(() => {});
    }, 1500);
  };

  const addItem = async () => {
    if (!newItemTitle.trim()) return;
    try {
      const item = await summaryItemService.create(dateCst, {
        title: newItemTitle.trim(),
        content: newItemContent.trim() || undefined,
        tag: newItemTag.trim() || undefined,
      });
      setItems(prev => [...prev, item]);
      setNewItemTitle('');
      setNewItemContent('');
      setNewItemTag('');
      setShowAddItem(false);
      setExpandedItems(prev => new Set(prev).add(item.id));
    } catch { /* ignore */ }
  };

  const deleteItem = async (id: string) => {
    try {
      await summaryItemService.delete(dateCst, id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch { /* ignore */ }
  };

  const handleDragStart = (id: string) => { dragItemRef.current = id; };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const handleDragLeave = () => setDragOverId(null);
  const handleDrop = async (targetId: string) => {
    setDragOverId(null);
    const dragId = dragItemRef.current;
    if (!dragId || dragId === targetId) return;
    const newItems = [...items];
    const dragIndex = newItems.findIndex(i => i.id === dragId);
    const targetIndex = newItems.findIndex(i => i.id === targetId);
    if (dragIndex === -1 || targetIndex === -1) return;
    const [moved] = newItems.splice(dragIndex, 1);
    newItems.splice(targetIndex, 0, moved);
    setItems(newItems);
    try {
      await summaryItemService.reorder(dateCst, newItems.map(i => i.id));
    } catch { /* ignore */ }
    dragItemRef.current = null;
  };

  if (!loaded) return null;

  return (
    <div className={styles.container}>
      <TasksBlock dateCst={dateCst} todayCst={todayCst} />

      {hasArchive && (
        <div className={styles.archive}>
          <button
            type="button"
            className={styles.archiveHeader}
            onClick={() => setArchiveExpanded(e => !e)}
            aria-expanded={archiveExpanded}
          >
            <span className={styles.archiveChevron}>{archiveExpanded ? '▾' : '▸'}</span>
            <span>Pre-migration notes</span>
            <span className={styles.archiveBadge}>read-only</span>
          </button>
          {archiveExpanded && (
            <div className={styles.archiveBody}>
              {goalsArchive && (
                <div className={styles.archiveSection}>
                  <div className={styles.archiveLabel}>Goals</div>
                  <div className={styles.archiveContent}>
                    <MarkdownLatex content={goalsArchive} />
                  </div>
                </div>
              )}
              {progressArchive && (
                <div className={styles.archiveSection}>
                  <div className={styles.archiveLabel}>Progress</div>
                  <div className={styles.archiveContent}>
                    <MarkdownLatex content={progressArchive} />
                  </div>
                </div>
              )}
              {openQuestionsArchive && (
                <div className={styles.archiveSection}>
                  <div className={styles.archiveLabel}>Open questions</div>
                  <div className={styles.archiveContent}>
                    <MarkdownLatex content={openQuestionsArchive} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className={styles.items}>
          {items.map(item => {
            const isExpanded = expandedItems.has(item.id);
            const isEditing = editingItemId === item.id;

            return (
              <div
                key={item.id}
                className={`${styles.item} ${dragOverId === item.id ? styles.itemDragOver : ''}`}
                draggable
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={e => handleDragOver(e, item.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(item.id)}
              >
                <div className={styles.itemHeader} onClick={() => toggleItem(item.id)}>
                  <span className={styles.dragHandle} title="Drag to reorder">&#8942;&#8942;</span>
                  {isEditing ? (
                    <input
                      className={styles.itemTitleInput}
                      value={item.title}
                      onChange={e => handleItemFieldChange(item.id, 'title', e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onBlur={() => setEditingItemId(null)}
                    />
                  ) : (
                    <span className={styles.itemTitle}>{item.title}</span>
                  )}
                  {item.tag && <span className={styles.itemTag}>{item.tag}</span>}
                  <button
                    className={styles.itemDeleteBtn}
                    onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                    title="Delete item"
                  >
                    &times;
                  </button>
                </div>
                {isExpanded && (
                  <div className={styles.itemBody}>
                    {isEditing ? (
                      <>
                        <textarea
                          className={styles.itemTextarea}
                          value={item.content || ''}
                          onChange={e => handleItemFieldChange(item.id, 'content', e.target.value)}
                          placeholder="Content (Markdown + LaTeX)..."
                          rows={3}
                        />
                        <input
                          className={styles.itemTagInput}
                          value={item.tag || ''}
                          onChange={e => handleItemFieldChange(item.id, 'tag', e.target.value)}
                          placeholder="Tag (optional)"
                        />
                      </>
                    ) : (
                      <div
                        className={styles.itemContent}
                        onClick={() => setEditingItemId(item.id)}
                      >
                        {item.content ? (
                          <MarkdownLatex content={item.content} />
                        ) : (
                          <span className={styles.itemPlaceholder}>Click to add content...</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddItem ? (
        <div className={styles.addItemForm}>
          <input
            className={styles.addItemTitle}
            value={newItemTitle}
            onChange={e => setNewItemTitle(e.target.value)}
            placeholder="Title (required)"
            autoFocus
          />
          <textarea
            className={styles.addItemContent}
            value={newItemContent}
            onChange={e => setNewItemContent(e.target.value)}
            placeholder="Content (optional, Markdown + LaTeX)"
            rows={2}
          />
          <input
            className={styles.addItemTag}
            value={newItemTag}
            onChange={e => setNewItemTag(e.target.value)}
            placeholder="Tag (optional)"
          />
          <div className={styles.addItemActions}>
            <button className={styles.cancelBtn} onClick={() => { setShowAddItem(false); setNewItemTitle(''); setNewItemContent(''); setNewItemTag(''); }}>
              Cancel
            </button>
            <button className={styles.submitBtn} onClick={addItem} disabled={!newItemTitle.trim()}>
              Add Item
            </button>
          </div>
        </div>
      ) : (
        <button className={styles.addItemBtn} onClick={() => setShowAddItem(true)}>
          + Add topic block
        </button>
      )}
    </div>
  );
}
