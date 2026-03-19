import { useState, useEffect, useRef, useCallback } from 'react';
import { SummaryItem } from '../../types';
import { daySummaryService, summaryItemService } from '../../services/api';
import MarkdownLatex from '../MarkdownLatex/MarkdownLatex';
import styles from './DaySummary.module.css';

interface Props {
  dateCst: string;
}

type TemplateField = 'goals' | 'progress' | 'open_questions';

const SECTIONS: { key: TemplateField; label: string; placeholder: string }[] = [
  { key: 'goals', label: 'Goals', placeholder: 'What do you plan to work on today?' },
  { key: 'progress', label: 'Progress', placeholder: 'What did you actually accomplish?' },
  { key: 'open_questions', label: 'Open questions', placeholder: 'Informal notes on unresolved things...' },
];

export default function DaySummary({ dateCst }: Props) {
  const [goals, setGoals] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [openQuestions, setOpenQuestions] = useState<string | null>(null);
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<TemplateField>>(new Set());
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

  const fieldState: Record<TemplateField, string | null> = { goals, progress, open_questions: openQuestions };
  const fieldStateRef = useRef<Record<TemplateField, string | null>>({ goals: null, progress: null, open_questions: null });
  fieldStateRef.current = { goals, progress, open_questions: openQuestions };
  const fieldSetters: Record<TemplateField, (v: string | null) => void> = {
    goals: setGoals,
    progress: setProgress,
    open_questions: setOpenQuestions,
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
    setExpandedSections(new Set());
    setExpandedItems(new Set());

    daySummaryService.get(dateCst).then(data => {
      setGoals(data.goals);
      setProgress(data.progress);
      setOpenQuestions(data.open_questions);
      setItems(data.items || []);

      // Auto-expand sections that have content
      const expanded = new Set<TemplateField>();
      if (data.goals) expanded.add('goals');
      if (data.progress) expanded.add('progress');
      if (data.open_questions) expanded.add('open_questions');
      setExpandedSections(expanded);

      const hasAny = data.goals || data.progress || data.open_questions || (data.items && data.items.length > 0);
      setShowTemplate(!!hasAny);
      setLoaded(true);
    }).catch(() => {
      setGoals(null);
      setProgress(null);
      setOpenQuestions(null);
      setItems([]);
      setShowTemplate(false);
      setLoaded(true);
    });

    return () => {
      // Flush pending debounce saves before switching dates or unmounting
      const fields: TemplateField[] = ['goals', 'progress', 'open_questions'];
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

  const toggleSection = (key: TemplateField) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setEditingSection(s => s === key ? null : s);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const startEditingSection = (key: TemplateField) => {
    setExpandedSections(prev => new Set(prev).add(key));
    setEditingSection(key);
  };

  const handleSectionBlur = (key: TemplateField) => {
    const currentValue = fieldStateRef.current[key];
    // Flush any pending debounce timer
    if (templateTimers.current[key]) {
      clearTimeout(templateTimers.current[key]);
      delete templateTimers.current[key];
    }
    if (!currentValue?.trim()) {
      // Empty — save null and collapse
      fieldSetters[key](null);
      saveTemplateField(key, null);
      setExpandedSections(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      // Save immediately on blur instead of waiting for debounce
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
      {/* Structured template sections */}
      <div className={styles.template}>
        {SECTIONS.map(({ key, label, placeholder }) => {
          const value = fieldState[key];
          const isExpanded = expandedSections.has(key);
          const isEditing = editingSection === key;

          return (
            <div key={key} className={styles.section}>
              <div
                className={styles.sectionHeader}
                onClick={() => value ? toggleSection(key) : startEditingSection(key)}
              >
                <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>&#9654;</span>
                <span className={styles.sectionLabel}>{label}</span>
                {!value && !isEditing && (
                  <button
                    className={styles.sectionAddBtn}
                    onClick={e => { e.stopPropagation(); startEditingSection(key); }}
                  >
                    +
                  </button>
                )}
              </div>
              {isExpanded && (
                <div className={styles.sectionBody}>
                  {isEditing ? (
                    <textarea
                      className={styles.sectionTextarea}
                      value={value || ''}
                      onChange={e => handleTemplateChange(key, e.target.value)}
                      onBlur={() => handleSectionBlur(key)}
                      placeholder={placeholder}
                      rows={2}
                      autoFocus
                    />
                  ) : value ? (
                    <div
                      className={styles.sectionContent}
                      onClick={() => startEditingSection(key)}
                    >
                      <MarkdownLatex content={value} />
                    </div>
                  ) : null}
                </div>
              )}
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
