import { createFirestoreStore } from '../utils/createFirestoreStore';
import type { Recipe } from '../types/recipe';

const store = createFirestoreStore<Recipe>('app-alimentacao:user-recipes', 'recipes');

export const getUserRecipes = store.getAll;
export const getUserRecipeById = store.getById;
export const upsertUserRecipe = store.upsert;
export const deleteUserRecipe = store.remove;
export const replaceUserRecipes = store.replace;
export const useUserRecipes = store.useAll;
