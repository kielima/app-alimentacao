import { createFirestoreStore } from '../utils/createFirestoreStore';
import type { Meal } from '../types/meal';

const store = createFirestoreStore<Meal>('app-alimentacao:user-meals', 'userMeals');

export const getUserMeals = store.getAll;
export const getUserMealById = store.getById;
export const upsertUserMeal = store.upsert;
export const deleteUserMeal = store.remove;
export const replaceUserMeals = store.replace;
export const useUserMeals = store.useAll;
