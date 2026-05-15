import { useMemo } from 'react';
import seed from '../../seed/recipes.json';
import type { RecipesSeed, Recipe, RecipeCategoryDef } from '../types/recipe';
import { getUserRecipes, getUserRecipeById, useUserRecipes } from './userRecipes';
import { getHiddenRecipeIds, useHiddenRecipeIds } from './hiddenRecipes';

const data = seed as unknown as RecipesSeed;

export const seedRecipes: Recipe[] = data.recipes;
export const recipeCategories: RecipeCategoryDef[] = data.categories;

/**
 * Lista completa: receitas do user (em localStorage) sobrescrevem as do seed
 * quando o id bate. Receitas novas (id que não existe no seed) entram no final.
 */
export function getAllRecipes(): Recipe[] {
  const userRecipes = getUserRecipes();
  const hidden = getHiddenRecipeIds();
  const userById = new Map(userRecipes.map((r) => [r.id, r]));
  return seedRecipes
    .map((r) => userById.get(r.id) ?? r)
    .concat(userRecipes.filter((r) => !seedRecipes.some((s) => s.id === r.id)))
    .filter((r) => !hidden.has(r.id));
}

export function useAllRecipes(): Recipe[] {
  const userRecipes = useUserRecipes();
  const hidden = useHiddenRecipeIds();
  return useMemo(() => {
    const userById = new Map(userRecipes.map((r) => [r.id, r]));
    return seedRecipes
      .map((r) => userById.get(r.id) ?? r)
      .concat(userRecipes.filter((r) => !seedRecipes.some((s) => s.id === r.id)))
      .filter((r) => !hidden.has(r.id));
  }, [userRecipes, hidden]);
}

/**
 * Receitas ocultas pelo usuário (apenas seeds — receitas do user são
 * deletadas de verdade). Usado pela UI de restauração.
 */
export function useHiddenSeedRecipes(): Recipe[] {
  const hidden = useHiddenRecipeIds();
  return useMemo(
    () => seedRecipes.filter((r) => hidden.has(r.id)),
    [hidden],
  );
}

export function findRecipeById(id: string): Recipe | undefined {
  return getUserRecipeById(id) ?? seedRecipes.find((r) => r.id === id);
}

export function isSeedRecipe(id: string): boolean {
  return seedRecipes.some((r) => r.id === id);
}

export function allRecipeIds(): Set<string> {
  return new Set([...seedRecipes.map((r) => r.id), ...getUserRecipes().map((r) => r.id)]);
}

export function findCategory(id: string): RecipeCategoryDef | undefined {
  return recipeCategories.find((c) => c.id === id);
}
