import { useMemo } from 'react';
import { useAllIngredients } from '../data/ingredients';
import { matches } from '../utils/search';
import { createUIStore } from '../utils/persistentUIState';
import { ingredientNutritionSource, type Ingredient } from '../types/ingredient';

export type IngredientFilter = 'todos' | 'marcas' | 'genericos' | 'a-verificar' | 'revisar';

export function ingredientNeedsReview(i: Ingredient): boolean {
  if (!i.nutrition_per_100) return true;
  return ingredientNutritionSource(i) == null;
}

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

const ui = createUIStore({
  query: '',
  filter: 'todos' as IngredientFilter,
  showFilters: false,
});

export function useIngredients(options: UseIngredientsOptions = {}): UseIngredientsResult {
  const { listedIngredientIds } = options;
  const { query, filter, showFilters } = ui.useStore();
  const allIngredients = useAllIngredients();

  const list = useMemo(() => {
    return allIngredients
      .filter((i) => {
        if (filter === 'marcas') return Boolean(i.brand);
        if (filter === 'genericos') return !i.brand;
        if (filter === 'a-verificar') return !listedIngredientIds?.has(i.id);
        if (filter === 'revisar') return ingredientNeedsReview(i);
        return true;
      })
      .filter((i) => matches(`${i.name} ${i.brand ?? ''}`, query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [query, filter, allIngredients, listedIngredientIds]);

  return {
    list,
    query,
    setQuery: (q) => ui.set('query', q),
    filter,
    setFilter: (f) => ui.set('filter', f),
    showFilters,
    setShowFilters: (s) => ui.set('showFilters', s),
    total: allIngredients.length,
  };
}
