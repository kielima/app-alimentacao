import { useMemo } from 'react';
import { useAllIngredients } from '../data/ingredients';
import { useHouseholdItems } from '../data/householdItems';
import { expiryStatus, type ExpiryStatus } from '../utils/expiry';
import { matches } from '../utils/search';
import { createUIStore } from '../utils/persistentUIState';
import { ingredientDisplayName } from '../utils/itemName';
import { ingredientStatus, ingredientStockUnit } from '../types/ingredient';
import { DISPENSA_STATUSES, type DispensaStatus } from '../types/dispensaStatus';
import type { Ingredient } from '../types/ingredient';
import type { HouseholdItem } from '../types/household';

export type DispensaItem =
  | { kind: 'ingredient'; data: Ingredient }
  | { kind: 'household'; data: HouseholdItem };

export type StatusFilter = 'todos' | DispensaStatus;
export type ExpiryFilter = 'todos' | ExpiryStatus;
export type DispensaKindFilter = 'all' | 'food' | 'household';

export function itemStatus(item: DispensaItem): DispensaStatus {
  return item.kind === 'ingredient' ? ingredientStatus(item.data) : item.data.status;
}

export function itemDisplayName(item: DispensaItem): string {
  return item.kind === 'ingredient' ? ingredientDisplayName(item.data) : item.data.raw_text;
}

export function itemExpiry(item: DispensaItem): { expiry_date: string | null | undefined; no_expiry?: boolean } {
  return { expiry_date: item.data.expiry_date, no_expiry: item.data.no_expiry };
}

export function itemKindOf(item: DispensaItem): 'food' | 'household' {
  return item.kind === 'household' ? 'household' : 'food';
}

/** Unidade da quantidade em posse/a comprar (unidade de instância, não a unidade
 *  padrão do catálogo do ingrediente). */
export function itemUnit(item: DispensaItem): string | null {
  return item.kind === 'ingredient' ? ingredientStockUnit(item.data) : item.data.unit;
}

const STATUS_PRIORITY: Record<DispensaStatus, number> = {
  dispensa: 0,
  comprar: 1,
  verificar: 2,
  backlog: 3,
};

const EXPIRY_ORDER: Record<ExpiryStatus, number> = {
  expired: 0,
  soon: 1,
  fresh: 2,
  'no-expiry': 3,
  'no-date': 4,
};

interface UseDispensaResult {
  list: DispensaItem[];
  query: string;
  setQuery: (q: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (f: StatusFilter) => void;
  kindFilter: DispensaKindFilter;
  setKindFilter: (k: DispensaKindFilter) => void;
  expiryFilter: ExpiryFilter;
  setExpiryFilter: (f: ExpiryFilter) => void;
  showFilters: boolean;
  setShowFilters: (s: boolean | ((prev: boolean) => boolean)) => void;
  total: number;
  statusCounts: Record<DispensaStatus, number>;
  kindCounts: { food: number; household: number };
  expiryCounts: Record<ExpiryStatus, number>;
}

const ui = createUIStore({
  query: '',
  statusFilter: 'todos' as StatusFilter,
  kindFilter: 'all' as DispensaKindFilter,
  expiryFilter: 'todos' as ExpiryFilter,
  showFilters: false,
});

export function useDispensa(): UseDispensaResult {
  const ingredients = useAllIngredients();
  const householdItems = useHouseholdItems();
  const { query, statusFilter, kindFilter, expiryFilter, showFilters } = ui.useStore();

  const allItems = useMemo<DispensaItem[]>(
    () => [
      ...ingredients.map((data): DispensaItem => ({ kind: 'ingredient', data })),
      ...householdItems.map((data): DispensaItem => ({ kind: 'household', data })),
    ],
    [ingredients, householdItems],
  );

  const statusCounts = useMemo(() => {
    const c = Object.fromEntries(DISPENSA_STATUSES.map((s) => [s.value, 0])) as Record<
      DispensaStatus,
      number
    >;
    for (const item of allItems) c[itemStatus(item)]++;
    return c;
  }, [allItems]);

  const kindCounts = useMemo(() => {
    let food = 0;
    let household = 0;
    for (const item of allItems) {
      if (itemKindOf(item) === 'household') household++;
      else food++;
    }
    return { food, household };
  }, [allItems]);

  const expiryCounts = useMemo(() => {
    const c: Record<ExpiryStatus, number> = {
      expired: 0,
      soon: 0,
      fresh: 0,
      'no-expiry': 0,
      'no-date': 0,
    };
    for (const item of allItems) {
      if (itemStatus(item) !== 'dispensa') continue;
      const e = itemExpiry(item);
      c[expiryStatus(e.expiry_date, e.no_expiry)]++;
    }
    return c;
  }, [allItems]);

  const list = useMemo(() => {
    return allItems
      .filter((i) => (statusFilter === 'todos' ? true : itemStatus(i) === statusFilter))
      .filter((i) => (kindFilter === 'all' ? true : itemKindOf(i) === kindFilter))
      .filter((i) => {
        if (expiryFilter === 'todos') return true;
        if (itemStatus(i) !== 'dispensa') return false;
        const e = itemExpiry(i);
        return expiryStatus(e.expiry_date, e.no_expiry) === expiryFilter;
      })
      .filter((i) => matches(itemDisplayName(i), query))
      .sort((a, b) => {
        const sa = itemStatus(a);
        const sb = itemStatus(b);
        if (sa !== sb) return STATUS_PRIORITY[sa] - STATUS_PRIORITY[sb];
        if (sa === 'dispensa') {
          const ea = itemExpiry(a);
          const eb = itemExpiry(b);
          const oa = EXPIRY_ORDER[expiryStatus(ea.expiry_date, ea.no_expiry)];
          const ob = EXPIRY_ORDER[expiryStatus(eb.expiry_date, eb.no_expiry)];
          if (oa !== ob) return oa - ob;
          if (ea.expiry_date && eb.expiry_date) return ea.expiry_date.localeCompare(eb.expiry_date);
          if (ea.expiry_date) return -1;
          if (eb.expiry_date) return 1;
        }
        return itemDisplayName(a).localeCompare(itemDisplayName(b), 'pt-BR');
      });
  }, [allItems, query, statusFilter, kindFilter, expiryFilter]);

  return {
    list,
    query,
    setQuery: (q) => ui.set('query', q),
    statusFilter,
    setStatusFilter: (f) => ui.set('statusFilter', f),
    kindFilter,
    setKindFilter: (k) => ui.set('kindFilter', k),
    expiryFilter,
    setExpiryFilter: (f) => ui.set('expiryFilter', f),
    showFilters,
    setShowFilters: (s) => ui.set('showFilters', s),
    total: allItems.length,
    statusCounts,
    kindCounts,
    expiryCounts,
  };
}
