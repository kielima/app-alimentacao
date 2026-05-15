import { useMemo } from 'react';
import seed from '../../seed/meals.json';
import type { Meal, MealsSeed } from '../types/meal';
import { getUserMeals, getUserMealById, useUserMeals } from './userMeals';

const data = seed as unknown as MealsSeed;

export const seedMeals: Meal[] = data.meals;

/**
 * Lista completa: refeições do user (em localStorage) sobrescrevem as do seed
 * quando o id bate. Refeições novas (id que não existe no seed) entram no final.
 */
export function getAllMeals(): Meal[] {
  const userMeals = getUserMeals();
  const userById = new Map(userMeals.map((m) => [m.id, m]));
  return seedMeals
    .map((m) => userById.get(m.id) ?? m)
    .concat(userMeals.filter((m) => !seedMeals.some((s) => s.id === m.id)));
}

export function useAllMeals(): Meal[] {
  const userMeals = useUserMeals();
  return useMemo(() => {
    const userById = new Map(userMeals.map((m) => [m.id, m]));
    return seedMeals
      .map((m) => userById.get(m.id) ?? m)
      .concat(userMeals.filter((m) => !seedMeals.some((s) => s.id === m.id)));
  }, [userMeals]);
}

export function findMealById(id: string): Meal | undefined {
  return getUserMealById(id) ?? seedMeals.find((m) => m.id === id);
}

export function isSeedMeal(id: string): boolean {
  return seedMeals.some((m) => m.id === id);
}

export function allMealIds(): Set<string> {
  return new Set([...seedMeals.map((m) => m.id), ...getUserMeals().map((m) => m.id)]);
}
