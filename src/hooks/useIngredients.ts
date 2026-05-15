import { useMemo, useState } from 'react';
import { useAllIngredients } from '../data/ingredients';
import { matches } from '../utils/search';
import type { Ingredient } from '../types/ingredient';

export type IngredientFilter = 'todos' | 'marcas' | 'genericos';

interface UseIngredientsResult {
  list: Ingredient[];
  query: string;
  setQuery: (q: string) => void;
  filter: IngredientFilter;
  setFilter: (f: IngredientFilter) => void;
  total: number;
}

export function useIngredients(): UseIngredientsResult {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<IngredientFilter>('todos');
  const allIngredients = useAllIngredients();

  const list = useMemo(() => {
    return allIngredients
      .filter((i) => {
        if (filter === 'marcas') return Boolean(i.brand);
        if (filter === 'genericos') return !i.brand;
        return true;
      })
      .filter((i) => matches(`${i.name} ${i.brand ?? ''}`, query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [query, filter, allIngredients]);

  return { list, query, setQuery, filter, setFilter, total: allIngredients.length };
}
