import { createFirestoreStore } from '../utils/createFirestoreStore';
import type { Ingredient } from '../types/ingredient';

const store = createFirestoreStore<Ingredient>(
  'app-alimentacao:user-ingredients',
  'userIngredients',
);

export const getUserIngredients = store.getAll;
export const getUserIngredientById = store.getById;
export const upsertUserIngredient = store.upsert;
export const deleteUserIngredient = store.remove;
export const useUserIngredients = store.useAll;
