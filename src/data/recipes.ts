import { useMemo } from 'react';
import type { Recipe } from '../types/recipe';
import { getUserRecipes, getUserRecipeById, useUserRecipes } from './userRecipes';
import { getHiddenRecipeIds, useHiddenRecipeIds } from './hiddenRecipes';

// Catálogo migrado para Firestore (users/{uid}/recipes). Sem catálogo base no app.
export const seedRecipes: Recipe[] = [];

// Categorias agora são dados do usuário (editáveis/criáveis) — ver `recipeCategories.ts`.
export {
  useRecipeCategories,
  getRecipeCategories,
  findRecipeCategory as findCategory,
} from './recipeCategories';

function applyHidden(list: Recipe[], hidden: Set<string>): Recipe[] {
  return hidden.size === 0 ? list : list.filter((r) => !hidden.has(r.id));
}

export function getAllRecipes(): Recipe[] {
  return applyHidden(getUserRecipes(), getHiddenRecipeIds());
}

export function useAllRecipes(): Recipe[] {
  const userRecipes = useUserRecipes();
  const hidden = useHiddenRecipeIds();
  return useMemo(() => applyHidden(userRecipes, hidden), [userRecipes, hidden]);
}

export function useHiddenSeedRecipes(): Recipe[] {
  return [];
}

export function findRecipeById(id: string): Recipe | undefined {
  return getUserRecipeById(id);
}

export function isSeedRecipe(_id: string): boolean {
  return false;
}

export function allRecipeIds(): Set<string> {
  return new Set(getUserRecipes().map((r) => r.id));
}
