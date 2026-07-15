import { useMemo } from 'react';
import { useAllRecipes } from '../data/recipes';
import { matches } from '../utils/search';
import { createUIStore } from '../utils/persistentUIState';
import { recipeCategoryIds, type Recipe, type Rating } from '../types/recipe';

export type CompletenessFilter = 'todas' | 'completas' | 'revisao';
export type RatingFilter = 0 | 3 | 4 | 5;

interface UseRecipesResult {
  list: Recipe[];
  query: string;
  setQuery: (q: string) => void;
  /** IDs das categorias desmarcadas (ocultas). Vazio = todas as categorias visíveis. */
  excludedCategories: string[];
  toggleCategory: (id: string) => void;
  completeness: CompletenessFilter;
  setCompleteness: (c: CompletenessFilter) => void;
  minRating: RatingFilter;
  setMinRating: (r: RatingFilter) => void;
  showFilters: boolean;
  setShowFilters: (s: boolean | ((prev: boolean) => boolean)) => void;
  total: number;
}

/** Categorias ocultas por padrão até o usuário ativá-las manualmente. */
const DEFAULT_EXCLUDED_CATEGORIES = ['bebidas'];

const ui = createUIStore({
  query: '',
  excludedCategories: DEFAULT_EXCLUDED_CATEGORIES as string[],
  completeness: 'todas' as CompletenessFilter,
  minRating: 0 as RatingFilter,
  showFilters: false,
});

export function useRecipes(): UseRecipesResult {
  const { query, excludedCategories, completeness, minRating, showFilters } = ui.useStore();
  const allRecipes = useAllRecipes();

  const list = useMemo(() => {
    return allRecipes
      .filter((r) => {
        const catIds = recipeCategoryIds(r);
        return catIds.length === 0 || catIds.some((id) => !excludedCategories.includes(id));
      })
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
  }, [query, excludedCategories, completeness, minRating, allRecipes]);

  return {
    list,
    query,
    setQuery: (q) => ui.set('query', q),
    excludedCategories,
    toggleCategory: (id) =>
      ui.set(
        'excludedCategories',
        excludedCategories.includes(id)
          ? excludedCategories.filter((c) => c !== id)
          : [...excludedCategories, id],
      ),
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
