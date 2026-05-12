import { useCallback, useEffect, useRef, useState } from 'react';
import { documentService } from '../services/api';
import { Document } from '../types';

export function useDocument(id: string | undefined) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setDoc(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    documentService.get(id)
      .then(setDoc)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  const save = useCallback(async (data: { title: string; content: string; tags?: string[]; source?: string | null }) => {
    if (!id) throw new Error('Cannot save: no document id');
    const updated = await documentService.update(id, data);
    setDoc(updated);
    return updated;
  }, [id]);

  return { doc, setDoc, loading, error, save };
}

export function useAutoSave<T>(value: T, save: (value: T) => Promise<void> | void, delayMs = 1500) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const initialRef = useRef(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }
    setSaved(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        await save(value);
        setSaved(true);
      } catch {
        // ignore — caller-side handling is up to consumers
      } finally {
        setSaving(false);
      }
    }, delayMs);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return { saving, saved };
}
