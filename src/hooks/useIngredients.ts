import { useEffect, useMemo, useReducer } from 'react';
import { useAllIngredients } from '../data/ingredients';
import { matches } from '../utils/search';
import type { Ingredient } from '../types/ingredient';

export type IngredientFilter = 'todos' | 'marcas' | 'genericos' | 'a-verificar';

interface UseIngredientsOptions {
  listedIngredientIds?: Set<string>;
}

interface UseIngredientsResult {
  list: Ingredient[];
  query: string;
  setQuery: (q: string) => void;
  filter: IngredientFilter;
  setFilter: (f: IngredientFilter) => void;
  showFilters: boolean;
  setShowFilters: (s: boolean | ((prev: boolean) => boolean)) => void;
  total: number;
}

const uiState = {
  query: '',
  filter: 'todos' as IngredientFilter,
  showFilters: false,
};
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function setQueryState(q: string) {
  if (uiState.query === q) return;
  uiState.query = q;
  emit();
}
function setFilterState(f: IngredientFilter) {
  if (uiState.filter === f) return;
  uiState.filter = f;
  emit();
}
function setShowFiltersState(s: boolean | ((prev: boolean) => boolean)) {
  const next = typeof s === 'function' ? s(uiState.showFilters) : s;
  if (uiState.showFilters === next) return;
  uiState.showFilters = next;
  emit();
}

export function useIngredients(options: UseIngredientsOptions = {}): UseIngredientsResult {
  const { listedIngredientIds } = options;
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  const allIngredients = useAllIngredients();

  const { query, filter, showFilters } = uiState;

  const list = useMemo(() => {
    return allIngredients
      .filter((i) => {
        if (filter === 'marcas') return Boolean(i.brand);
        if (filter === 'genericos') return !i.brand;
        if (filter === 'a-verificar') return !listedIngredientIds?.has(i.id);
        return true;
      })
      .filter((i) => matches(`${i.name} ${i.brand ?? ''}`, query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [query, filter, allIngredients, listedIngredientIds]);

  return {
    list,
    query,
    setQuery: setQueryState,
    filter,
    setFilter: setFilterState,
    showFilters,
    setShowFilters: setShowFiltersState,
    total: allIngredients.length,
  };
}
