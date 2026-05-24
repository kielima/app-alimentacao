import type { Meal } from '../types/meal';
import { getUserMeals, getUserMealById, useUserMeals } from './userMeals';

// Catálogo migrado para Firestore (users/{uid}/userMeals). Sem catálogo base no app.
export const seedMeals: Meal[] = [];

export function getAllMeals(): Meal[] {
  return getUserMeals();
}

export function useAllMeals(): Meal[] {
  return useUserMeals();
}

export function findMealById(id: string): Meal | undefined {
  return getUserMealById(id);
}

export function isSeedMeal(_id: string): boolean {
  return false;
}

export function allMealIds(): Set<string> {
  return new Set(getUserMeals().map((m) => m.id));
}
