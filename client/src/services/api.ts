import { Entry, EntryWithResolution, DaySummary, SummaryItem, ReviewCard, DueCard, StatsOverview, HeatmapEntry, ForecastEntry, ReviewHistoryEntry, TagCount, ReviewRating, OpenStats, EntryPriority, ScribeBook, Task, TaskState, TaskKind, Document, DocumentStats, DocumentFilters } from '../types';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const entryService = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Entry[]>('GET', `/entries${qs}`);
  },
  get: (id: string) => request<Entry>('GET', `/entries/${id}`),
  create: (data: { content: string; tags?: string[]; entry_type?: string; source?: string; links?: unknown[]; priority?: string | null }) =>
    request<Entry>('POST', '/entries', data),
  update: (id: string, data: { content: string; tags?: string[]; entry_type?: string; source?: string; links?: unknown[]; status?: string | null; priority?: string | null }) =>
    request<Entry>('PUT', `/entries/${id}`, data),
  delete: (id: string) => request<{ success: boolean }>('DELETE', `/entries/${id}`),
  promote: (id: string, cards: { card_type?: string; front: string; back: string }[]) =>
    request<ReviewCard[]>('POST', `/entries/${id}/promote`, { cards }),
  demote: (id: string) => request<{ success: boolean }>('DELETE', `/entries/${id}/demote`),
  updatePriority: (id: string, priority: NonNullable<EntryPriority>) =>
    request<Entry>('PATCH', `/entries/${id}/priority`, { priority }),
  resolve: (id: string, data: { content: string; tags?: string[]; entry_type?: string; source?: string }) =>
    request<{ entry: Entry; resolution_entry: Entry }>('POST', `/entries/${id}/resolve`, data),
  reopen: (id: string) => request<Entry>('POST', `/entries/${id}/reopen`),
  getWithResolution: (id: string) => request<EntryWithResolution>('GET', `/entries/${id}`),
};

export const daySummaryService = {
  get: (dateCst: string) => request<DaySummary>('GET', `/day-summaries/${dateCst}`),
  save: (dateCst: string, data: { goals?: string | null; progress?: string | null; open_questions?: string | null; scratch?: string | null }) =>
    request<DaySummary>('PUT', `/day-summaries/${dateCst}`, data),
};

export const summaryItemService = {
  list: (dateCst: string) => request<SummaryItem[]>('GET', `/day-summaries/${dateCst}/items`),
  create: (dateCst: string, data: { title: string; content?: string; tag?: string }) =>
    request<SummaryItem>('POST', `/day-summaries/${dateCst}/items`, data),
  update: (dateCst: string, id: string, data: { title?: string; content?: string | null; tag?: string | null }) =>
    request<SummaryItem>('PUT', `/day-summaries/${dateCst}/items/${id}`, data),
  delete: (dateCst: string, id: string) =>
    request<{ success: boolean }>('DELETE', `/day-summaries/${dateCst}/items/${id}`),
  reorder: (dateCst: string, ids: string[]) =>
    request<SummaryItem[]>('PATCH', `/day-summaries/${dateCst}/items/reorder`, { ids }),
};

export const reviewService = {
  getDue: () => request<DueCard[]>('GET', '/review/due'),
  listCards: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<ReviewCard[]>('GET', `/review/cards${qs}`);
  },
  getCard: (id: string) => request<DueCard>('GET', `/review/cards/${id}`),
  updateCard: (id: string, data: { front: string; back: string }) =>
    request<ReviewCard>('PUT', `/review/cards/${id}`, data),
  rate: (id: string, rating: ReviewRating, durationMs?: number) =>
    request<ReviewCard>('POST', `/review/cards/${id}/rate`, { rating, duration_ms: durationMs }),
};

export const statsService = {
  overview: () => request<StatsOverview>('GET', '/stats/overview'),
  heatmap: (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const qs = params.toString() ? `?${params}` : '';
    return request<HeatmapEntry[]>('GET', `/stats/heatmap${qs}`);
  },
  forecast: (days?: number) => {
    const qs = days ? `?days=${days}` : '';
    return request<ForecastEntry[]>('GET', `/stats/forecast${qs}`);
  },
  reviewHistory: (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const qs = params.toString() ? `?${params}` : '';
    return request<ReviewHistoryEntry[]>('GET', `/stats/review-history${qs}`);
  },
};

export const openService = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Entry[]>('GET', `/open${qs}`);
  },
  stats: () => request<OpenStats>('GET', '/open/stats'),
};

export const tagService = {
  list: () => request<TagCount[]>('GET', '/tags'),
};

export const scribeService = {
  searchBooks: (query: string) => {
    const qs = query ? `?q=${encodeURIComponent(query)}` : '';
    return request<ScribeBook[]>('GET', `/scribe/books${qs}`);
  },
};

export const sourceService = {
  list: () => request<{ source: string; count: number }[]>('GET', '/sources'),
};

export const taskService = {
  list: (filters?: { state?: TaskState[]; createdOn?: string; completedOn?: string; since?: string; until?: string }) => {
    const params = new URLSearchParams();
    if (filters?.state && filters.state.length > 0) params.set('state', filters.state.join(','));
    if (filters?.createdOn) params.set('created_on', filters.createdOn);
    if (filters?.completedOn) params.set('completed_on', filters.completedOn);
    if (filters?.since) params.set('since', filters.since);
    if (filters?.until) params.set('until', filters.until);
    const qs = params.toString() ? `?${params}` : '';
    return request<Task[]>('GET', `/tasks${qs}`);
  },
  listActive: () => request<Task[]>('GET', '/tasks/active'),
  listByDay: (dateCst: string) => request<Task[]>('GET', `/tasks/by-day/${dateCst}`),
  get: (id: string) => request<Task>('GET', `/tasks/${id}`),
  create: (data: { title: string; notes?: string; state?: TaskState; kind?: TaskKind }) =>
    request<Task>('POST', '/tasks', data),
  update: (id: string, data: { title?: string; notes?: string | null; kind?: TaskKind }) =>
    request<Task>('PUT', `/tasks/${id}`, data),
  setState: (id: string, state: TaskState, reason?: string) =>
    request<Task>('PATCH', `/tasks/${id}/state`, { state, reason }),
  keep: (id: string) => request<Task>('PATCH', `/tasks/${id}/keep`),
  reorder: (ids: string[]) => request<{ success: boolean }>('PATCH', '/tasks/reorder', { ids }),
  delete: (id: string) => request<{ success: boolean }>('DELETE', `/tasks/${id}`),
};

export const documentService = {
  list: (filters?: DocumentFilters) => {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.tag) params.set('tag', filters.tag);
    if (filters?.source) params.set('source', filters.source);
    if (filters?.start) params.set('start', filters.start);
    if (filters?.end) params.set('end', filters.end);
    if (filters?.has_open_todos !== undefined) params.set('has_open_todos', String(filters.has_open_todos));
    if (filters?.archived) params.set('archived', 'true');
    const qs = params.toString() ? `?${params}` : '';
    return request<Document[]>('GET', `/documents${qs}`);
  },
  get: (id: string) => request<Document>('GET', `/documents/${id}`),
  create: (data: { title: string; content: string; tags?: string[]; source?: string | null }) =>
    request<Document>('POST', '/documents', data),
  update: (id: string, data: { title: string; content: string; tags?: string[]; source?: string | null }) =>
    request<Document>('PUT', `/documents/${id}`, data),
  delete: (id: string) => request<{ success: boolean }>('DELETE', `/documents/${id}`),
  setArchived: (id: string, archived: boolean) =>
    request<Document>('PATCH', `/documents/${id}/archive`, { archived }),
  stats: () => request<DocumentStats>('GET', '/documents/stats'),
  importPaste: (data: { title: string; content: string; tags?: string[]; source?: string }) =>
    request<Document[]>('POST', '/documents/import', data),
  importFiles: async (files: File[], titles?: (string | null)[]): Promise<Document[]> => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    if (titles) form.append('titles', JSON.stringify(titles));
    const response = await fetch('/api/documents/import', { method: 'POST', body: form });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Import failed' }));
      throw new Error(error.error || 'Import failed');
    }
    return response.json();
  },
  exportUrl: (id: string) => `/api/documents/${id}/export`,
};

export const settingsService = {
  getAll: () => request<Record<string, string>>('GET', '/settings'),
  get: (key: string) => request<{ key: string; value: string }>('GET', `/settings/${key}`),
  set: (key: string, value: string) => request<{ key: string; value: string }>('PUT', `/settings/${key}`, { value }),
};
