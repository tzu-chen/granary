import { useCallback, useEffect, useState } from 'react';
import { documentService } from '../services/api';
import { Document, DocumentFilters } from '../types';

export function useDocuments(filters: DocumentFilters) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await documentService.list(filters);
      setDocuments(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
    // Re-run whenever any filter value changes.
  }, [filters.search, filters.tag, filters.source, filters.start, filters.end, filters.has_open_todos]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { documents, loading, error, refresh };
}
