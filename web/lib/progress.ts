'use client';

import { useCallback, useEffect, useState } from 'react';

export interface GuideProgress {
  /** Highest section index reached, 0-based. */
  furthest: number;
  /** Section index the reader was last on. */
  last: number;
  /** ISO date of the last time this guide was opened. */
  openedAt: string;
  /** Quiz questions the reader flagged "needs review", by question index. */
  needsReview: number[];
}

const KEY = 'study-guides:progress';

type Store = Record<string, GuideProgress>;

function read(): Store {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '{}') as Store;
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage can be unavailable (private mode, quota). Progress is a
    // convenience, so losing it must never break reading.
  }
  window.dispatchEvent(new Event('study-guides:progress'));
}

/**
 * Progress lives in localStorage, not the guide JSON — the guides are a static
 * export with no backend, and progress is per-reader.
 *
 * Starts empty on every render and fills in after mount, so the server-rendered
 * HTML and the first client render agree. Reading `localStorage` during render
 * would hydrate-mismatch.
 */
export function useProgress() {
  const [store, setStore] = useState<Store>({});

  useEffect(() => {
    const sync = () => setStore(read());
    sync();
    window.addEventListener('study-guides:progress', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('study-guides:progress', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const record = useCallback((slug: string, section: number) => {
    const store = read();
    const prev = store[slug];
    store[slug] = {
      furthest: Math.max(prev?.furthest ?? 0, section),
      last: section,
      openedAt: new Date().toISOString(),
      needsReview: prev?.needsReview ?? [],
    };
    write(store);
  }, []);

  const setNeedsReview = useCallback((slug: string, question: number, flagged: boolean) => {
    const store = read();
    const prev = store[slug] ?? { furthest: 0, last: 0, openedAt: new Date().toISOString(), needsReview: [] };
    const set = new Set(prev.needsReview);
    if (flagged) set.add(question);
    else set.delete(question);
    store[slug] = { ...prev, needsReview: [...set].sort((a, b) => a - b) };
    write(store);
  }, []);

  return { progress: store, record, setNeedsReview };
}
