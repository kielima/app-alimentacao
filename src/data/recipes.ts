import seed from '../../seed/recipes.json';
import type { RecipesSeed, Recipe, RecipeCategoryDef } from '../types/recipe';
import { getUserRecipes, getUserRecipeById } from './userRecipes';

const data = seed as unknown as RecipesSeed;

export const seedRecipes: Recipe[] = data.recipes;
export const recipeCategories: RecipeCategoryDef[] = data.categories;

/**
 * Lista completa: receitas do user (em localStorage) sobrescrevem as do seed
 * quando o id bate. Receitas novas (id que não existe no seed) entram no final.
 */
export function getAllRecipes(): Recipe[] {
  const userRecipes = getUserRecipes();
  const userById = new Map(userRecipes.map((r) => [r.id, r]));
  return seedRecipes.map((r) => userById.get(r.id) ?? r).concat(
    userRecipes.filter((r) => !seedRecipes.some((s) => s.id === r.id)),
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
