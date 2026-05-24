import { useMemo } from 'react';
import type { Recipe, RecipeCategoryDef } from '../types/recipe';
import { getUserRecipes, getUserRecipeById, useUserRecipes } from './userRecipes';
import { getHiddenRecipeIds, useHiddenRecipeIds } from './hiddenRecipes';

// Catálogo migrado para Firestore (users/{uid}/recipes). Sem catálogo base no app.
export const seedRecipes: Recipe[] = [];

// Lookup table fixa: categorias não são user data.
export const recipeCategories: RecipeCategoryDef[] = [
  { id: 'pratos-principais', name: 'Pratos Principais', icon: '🍽️' },
  { id: 'bebidas', name: 'Bebidas', icon: '🍹' },
  { id: 'sobremesas-e-lanches', name: 'Sobremesas e Lanches', icon: '🍰' },
  { id: 'molhos-temperos-acompanhamentos', name: 'Molhos, Temperos e Acompanhamentos', icon: '🥣' },
];

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

export function findCategory(id: string): RecipeCategoryDef | undefined {
  return recipeCategories.find((c) => c.id === id);
}
