import { useMemo, useState } from 'react';
import { usePantryItems } from '../data/pantry';
import { expiryStatus, type ExpiryStatus } from '../utils/expiry';
import { matches } from '../utils/search';
import type { PantryItem } from '../types/pantry';

export type PantryFilter = 'todos' | ExpiryStatus;

const STATUS_ORDER: Record<ExpiryStatus, number> = {
  expired: 0,
  soon: 1,
  fresh: 2,
  'no-date': 3,
};

interface UsePantryResult {
  list: PantryItem[];
  query: string;
  setQuery: (q: string) => void;
  filter: PantryFilter;
  setFilter: (f: PantryFilter) => void;
  total: number;
  countsByStatus: Record<ExpiryStatus, number>;
}

export function usePantry(): UsePantryResult {
  const items = usePantryItems();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PantryFilter>('todos');

  const countsByStatus = useMemo(() => {
    const c: Record<ExpiryStatus, number> = { expired: 0, soon: 0, fresh: 0, 'no-date': 0 };
    for (const item of items) {
      c[expiryStatus(item.expiry_date)]++;
    }
    return c;
  }, [items]);

  const list = useMemo(() => {
    return items
      .filter((i) => (filter === 'todos' ? true : expiryStatus(i.expiry_date) === filter))
      .filter((i) => matches(i.raw_text, query))
      .sort((a, b) => {
        const sa = STATUS_ORDER[expiryStatus(a.expiry_date)];
        const sb = STATUS_ORDER[expiryStatus(b.expiry_date)];
        if (sa !== sb) return sa - sb;
        // Within same status: sort by expiry date ascending (closest first)
        if (a.expiry_date && b.expiry_date) {
          return a.expiry_date.localeCompare(b.expiry_date);
        }
        if (a.expiry_date) return -1;
        if (b.expiry_date) return 1;
        return a.raw_text.localeCompare(b.raw_text, 'pt-BR');
      });
  }, [items, query, filter]);

  return {
    list,
    query,
    setQuery,
    filter,
    setFilter,
    total: items.length,
    countsByStatus,
  };
}
