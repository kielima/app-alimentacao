import { useMemo } from 'react';
import { usePantryItems } from '../data/pantry';
import { expiryStatus, type ExpiryStatus } from '../utils/expiry';
import { matches } from '../utils/search';
import { createUIStore } from '../utils/persistentUIState';
import type { PantryItem } from '../types/pantry';

export type PantryFilter = 'todos' | ExpiryStatus;
export type PantryKindFilter = 'all' | 'food' | 'household';

function pantryKind(item: PantryItem): 'food' | 'household' {
  return item.kind === 'household' ? 'household' : 'food';
}

const STATUS_ORDER: Record<ExpiryStatus, number> = {
  expired: 0,
  soon: 1,
  fresh: 2,
  'no-expiry': 3,
  'no-date': 4,
};

interface UsePantryResult {
  list: PantryItem[];
  query: string;
  setQuery: (q: string) => void;
  filter: PantryFilter;
  setFilter: (f: PantryFilter) => void;
  kindFilter: PantryKindFilter;
  setKindFilter: (k: PantryKindFilter) => void;
  showFilters: boolean;
  setShowFilters: (s: boolean | ((prev: boolean) => boolean)) => void;
  total: number;
  countsByStatus: Record<ExpiryStatus, number>;
  kindCounts: { food: number; household: number };
}

const ui = createUIStore({
  query: '',
  filter: 'todos' as PantryFilter,
  kindFilter: 'all' as PantryKindFilter,
  showFilters: false,
});

export function usePantry(): UsePantryResult {
  const items = usePantryItems();
  const { query, filter, kindFilter, showFilters } = ui.useStore();

  const countsByStatus = useMemo(() => {
    const c: Record<ExpiryStatus, number> = {
      expired: 0,
      soon: 0,
      fresh: 0,
      'no-expiry': 0,
      'no-date': 0,
    };
    for (const item of items) {
      c[expiryStatus(item.expiry_date, item.no_expiry)]++;
    }
    return c;
  }, [items]);

  const kindCounts = useMemo(() => {
    let food = 0;
    let household = 0;
    for (const item of items) {
      if (pantryKind(item) === 'household') household++;
      else food++;
    }
    return { food, household };
  }, [items]);

  const list = useMemo(() => {
    return items
      .filter((i) => (kindFilter === 'all' ? true : pantryKind(i) === kindFilter))
      .filter((i) =>
        filter === 'todos' ? true : expiryStatus(i.expiry_date, i.no_expiry) === filter,
      )
      .filter((i) => matches(i.raw_text, query))
      .sort((a, b) => {
        const sa = STATUS_ORDER[expiryStatus(a.expiry_date, a.no_expiry)];
        const sb = STATUS_ORDER[expiryStatus(b.expiry_date, b.no_expiry)];
        if (sa !== sb) return sa - sb;
        // Within same status: sort by expiry date ascending (closest first)
        if (a.expiry_date && b.expiry_date) {
          return a.expiry_date.localeCompare(b.expiry_date);
        }
        if (a.expiry_date) return -1;
        if (b.expiry_date) return 1;
        return a.raw_text.localeCompare(b.raw_text, 'pt-BR');
      });
  }, [items, query, filter, kindFilter]);

  return {
    list,
    query,
    setQuery: (q) => ui.set('query', q),
    filter,
    setFilter: (f) => ui.set('filter', f),
    kindFilter,
    setKindFilter: (k) => ui.set('kindFilter', k),
    showFilters,
    setShowFilters: (s) => ui.set('showFilters', s),
    total: items.length,
    countsByStatus,
    kindCounts,
  };
}
