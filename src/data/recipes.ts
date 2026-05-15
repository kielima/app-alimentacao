import seed from '../../seed/recipes.json';
import type { RecipesSeed, Recipe, RecipeCategoryDef } from '../types/recipe';

const data = seed as unknown as RecipesSeed;

export const allRecipes: Recipe[] = data.recipes;
export const recipeCategories: RecipeCategoryDef[] = data.categories;

export function findRecipeById(id: string): Recipe | undefined {
  return allRecipes.find((r) => r.id === id);
}

export function findCategory(id: string): RecipeCategoryDef | undefined {
  return recipeCategories.find((c) => c.id === id);
}
