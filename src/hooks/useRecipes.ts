import { useMemo, useState } from 'react';
import { useAllRecipes } from '../data/recipes';
import { matches } from '../utils/search';
import type { Recipe, RecipeCategoryId, Rating } from '../types/recipe';

export type CompletenessFilter = 'todas' | 'completas' | 'revisao';
export type RatingFilter = 0 | 3 | 4 | 5;

interface UseRecipesResult {
  list: Recipe[];
  query: string;
  setQuery: (q: string) => void;
  category: RecipeCategoryId | 'todas';
  setCategory: (c: RecipeCategoryId | 'todas') => void;
  completeness: CompletenessFilter;
  setCompleteness: (c: CompletenessFilter) => void;
  minRating: RatingFilter;
  setMinRating: (r: RatingFilter) => void;
  total: number;
}

export function useRecipes(): UseRecipesResult {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<RecipeCategoryId | 'todas'>('todas');
  const [completeness, setCompleteness] = useState<CompletenessFilter>('todas');
  const [minRating, setMinRating] = useState<RatingFilter>(0);

  const allRecipes = useAllRecipes();

  const list = useMemo(() => {
    return allRecipes
      .filter((r) => category === 'todas' || r.category === category)
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
  }, [query, category, completeness, minRating, allRecipes]);

  return {
    list,
    query,
    setQuery,
    category,
    setCategory,
    completeness,
    setCompleteness,
    minRating,
    setMinRating,
    total: allRecipes.length,
  };
}

export function isRecipeComplete(r: Recipe): boolean {
  return !r.needs_review && (r.ingredients?.length ?? 0) > 0 && (r.steps?.length ?? 0) > 0;
}

export function recipeRating(r: Recipe): Rating | null {
  return r.rating ?? null;
}
