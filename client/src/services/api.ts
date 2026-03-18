import { Entry, DaySummary, ReviewCard, DueCard, StatsOverview, HeatmapEntry, ForecastEntry, ReviewHistoryEntry, TagCount, ReviewRating } from '../types';

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
  create: (data: { content: string; tags?: string[]; entry_type?: string; source?: string; links?: unknown[] }) =>
    request<Entry>('POST', '/entries', data),
  update: (id: string, data: { content: string; tags?: string[]; entry_type?: string; source?: string; links?: unknown[] }) =>
    request<Entry>('PUT', `/entries/${id}`, data),
  delete: (id: string) => request<{ success: boolean }>('DELETE', `/entries/${id}`),
  promote: (id: string, cards: { card_type?: string; front: string; back: string }[]) =>
    request<ReviewCard[]>('POST', `/entries/${id}/promote`, { cards }),
  demote: (id: string) => request<{ success: boolean }>('DELETE', `/entries/${id}/demote`),
};

export const daySummaryService = {
  get: (dateCst: string) => request<DaySummary>('GET', `/day-summaries/${dateCst}`),
  save: (dateCst: string, content: string) => request<DaySummary>('PUT', `/day-summaries/${dateCst}`, { content }),
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

export const tagService = {
  list: () => request<TagCount[]>('GET', '/tags'),
};

export const settingsService = {
  getAll: () => request<Record<string, string>>('GET', '/settings'),
  get: (key: string) => request<{ key: string; value: string }>('GET', `/settings/${key}`),
  set: (key: string, value: string) => request<{ key: string; value: string }>('PUT', `/settings/${key}`, { value }),
};
