import { useMemo } from 'react';
import { useAllRecipes } from '../data/recipes';
import { matches } from '../utils/search';
import { createUIStore } from '../utils/persistentUIState';
import type { Recipe, Rating } from '../types/recipe';

export type CompletenessFilter = 'todas' | 'completas' | 'revisao';
export type RatingFilter = 0 | 3 | 4 | 5;

interface UseRecipesResult {
  list: Recipe[];
  query: string;
  setQuery: (q: string) => void;
  /** IDs das categorias selecionadas. Vazio = todas as categorias. */
  categories: string[];
  toggleCategory: (id: string) => void;
  clearCategories: () => void;
  completeness: CompletenessFilter;
  setCompleteness: (c: CompletenessFilter) => void;
  minRating: RatingFilter;
  setMinRating: (r: RatingFilter) => void;
  showFilters: boolean;
  setShowFilters: (s: boolean | ((prev: boolean) => boolean)) => void;
  total: number;
}

const ui = createUIStore({
  query: '',
  categories: [] as string[],
  completeness: 'todas' as CompletenessFilter,
  minRating: 0 as RatingFilter,
  showFilters: false,
});

export function useRecipes(): UseRecipesResult {
  const { query, categories, completeness, minRating, showFilters } = ui.useStore();
  const allRecipes = useAllRecipes();

  const list = useMemo(() => {
    return allRecipes
      .filter((r) => categories.length === 0 || categories.includes(r.category))
      .filter((r) => {
        if (completeness === 'completas') return !r.needs_review;
        if (completeness === 'revisao') return r.needs_review === true;
        return true;
      })
      .filter((r) => {
        if (minRating === 0) return true;
        return (r.rating ?? 0) >= minRating;
      })
      .filter((r) => matches(r.name, query))
      .sort((a, b) => {
        if (!!a.needs_review !== !!b.needs_review) return a.needs_review ? 1 : -1;
        const rDiff = (b.rating ?? 0) - (a.rating ?? 0);
        if (rDiff !== 0) return rDiff;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
  }, [query, categories, completeness, minRating, allRecipes]);

  return {
    list,
    query,
    setQuery: (q) => ui.set('query', q),
    categories,
    toggleCategory: (id) =>
      ui.set(
        'categories',
        categories.includes(id) ? categories.filter((c) => c !== id) : [...categories, id],
      ),
    clearCategories: () => ui.set('categories', []),
    completeness,
    setCompleteness: (c) => ui.set('completeness', c),
    minRating,
    setMinRating: (r) => ui.set('minRating', r),
    showFilters,
    setShowFilters: (s) => ui.set('showFilters', s),
    total: allRecipes.length,
  };
}

export function isRecipeComplete(r: Recipe): boolean {
  return !r.needs_review && (r.ingredients?.length ?? 0) > 0 && (r.steps?.length ?? 0) > 0;
}

export function recipeRating(r: Recipe): Rating | null {
  return r.rating ?? null;
}
