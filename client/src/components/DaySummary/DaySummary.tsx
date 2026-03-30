import { useState, useEffect, useRef, useCallback } from 'react';
import { SummaryItem } from '../../types';
import { daySummaryService, summaryItemService } from '../../services/api';
import MarkdownLatex from '../MarkdownLatex/MarkdownLatex';
import styles from './DaySummary.module.css';

interface Props {
  dateCst: string;
}

type TemplateField = 'goals' | 'progress';

const SECTIONS: { key: TemplateField; label: string; placeholder: string }[] = [
  { key: 'goals', label: 'Goals', placeholder: 'What do you plan to work on today?' },
  { key: 'progress', label: 'Progress', placeholder: 'What did you actually accomplish?' },
];

export default function DaySummary({ dateCst }: Props) {
  const [goals, setGoals] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingSection, setEditingSection] = useState<TemplateField | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemTag, setNewItemTag] = useState('');
  const [showTemplate, setShowTemplate] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);

  const templateTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const itemTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fieldState: Record<TemplateField, string | null> = { goals, progress };
  const fieldStateRef = useRef<Record<TemplateField, string | null>>({ goals: null, progress: null });
  fieldStateRef.current = { goals, progress };
  const fieldSetters: Record<TemplateField, (v: string | null) => void> = {
    goals: setGoals,
    progress: setProgress,
  };

  // --- Template section handlers ---

  const saveTemplateField = useCallback((field: TemplateField, value: string | null) => {
    daySummaryService.save(dateCst, { [field]: value }).catch(() => {});
  }, [dateCst]);

  useEffect(() => {
    setLoaded(false);
    setEditingSection(null);
    setEditingItemId(null);
    setShowAddItem(false);
    setShowTemplate(false);
    setExpandedItems(new Set());

    daySummaryService.get(dateCst).then(data => {
      setGoals(data.goals);
      setProgress(data.progress);
      setItems(data.items || []);

      const hasAny = data.goals || data.progress || (data.items && data.items.length > 0);
      setShowTemplate(!!hasAny);
      setLoaded(true);
    }).catch(() => {
      setGoals(null);
      setProgress(null);
      setItems([]);
      setShowTemplate(false);
      setLoaded(true);
    });

    return () => {
      // Flush pending debounce saves before switching dates or unmounting
      const fields: TemplateField[] = ['goals', 'progress'];
      for (const field of fields) {
        if (templateTimers.current[field]) {
          clearTimeout(templateTimers.current[field]);
          delete templateTimers.current[field];
          const value = fieldStateRef.current[field];
          saveTemplateField(field, value);
        }
      }
    };
  }, [dateCst, saveTemplateField]);

  const handleTemplateChange = (field: TemplateField, value: string) => {
    const finalValue = value || null;
    fieldSetters[field](finalValue);
    fieldStateRef.current[field] = finalValue;
    if (templateTimers.current[field]) clearTimeout(templateTimers.current[field]);
    templateTimers.current[field] = setTimeout(() => saveTemplateField(field, finalValue), 1500);
  };

  const startEditingSection = (key: TemplateField) => {
    setEditingSection(key);
  };

  const handleSectionBlur = (key: TemplateField) => {
    const currentValue = fieldStateRef.current[key];
    if (templateTimers.current[key]) {
      clearTimeout(templateTimers.current[key]);
      delete templateTimers.current[key];
    }
    if (!currentValue?.trim()) {
      fieldSetters[key](null);
      saveTemplateField(key, null);
    } else {
      saveTemplateField(key, currentValue);
    }
    setEditingSection(null);
  };

  // --- Summary item handlers ---

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

  // --- Drag and drop reorder ---

  const handleDragStart = (id: string) => {
    dragItemRef.current = id;
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

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

  // If no template content and no items, show the "Add summary" button
  if (!showTemplate) {
    return (
      <div className={styles.container}>
        <button className={styles.addSummaryBtn} onClick={() => setShowTemplate(true)}>
          + Add summary
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Goals & Progress post-it notes */}
      <div className={styles.noteGrid}>
        {SECTIONS.map(({ key, label, placeholder }) => {
          const value = fieldState[key];
          const isEditing = editingSection === key;

          return (
            <div key={key} className={styles.note}>
              <div className={styles.noteLabel}>{label}</div>
              <div className={styles.noteRuled}>
                {isEditing ? (
                  <textarea
                    className={styles.noteTextarea}
                    value={value || ''}
                    onChange={e => handleTemplateChange(key, e.target.value)}
                    onBlur={() => handleSectionBlur(key)}
                    placeholder={placeholder}
                    autoFocus
                  />
                ) : value ? (
                  <div
                    className={styles.noteContent}
                    onClick={() => startEditingSection(key)}
                  >
                    <MarkdownLatex content={value} />
                  </div>
                ) : (
                  <div
                    className={styles.notePlaceholder}
                    onClick={() => startEditingSection(key)}
                  >
                    {placeholder}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary items */}
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

      {/* Add item */}
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
