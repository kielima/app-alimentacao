import { useMemo } from 'react';
import seed from '../../seed/ingredients.json';
import type { IngredientsSeed, Ingredient } from '../types/ingredient';
import { getUserIngredients, useUserIngredients } from './userIngredients';
import { getHiddenIngredientIds, useHiddenIngredientIds } from './hiddenIngredients';

const data = seed as IngredientsSeed;

export const seedIngredients: Ingredient[] = data.ingredients;

// Backward-compat alias (non-reactive, seed only)
export const allIngredients: Ingredient[] = seedIngredients;

export function getAllIngredients(): Ingredient[] {
  const hidden = getHiddenIngredientIds();
  return [...seedIngredients, ...getUserIngredients()].filter((i) => !hidden.has(i.id));
}

export function useAllIngredients(): Ingredient[] {
  const userIngredients = useUserIngredients();
  const hidden = useHiddenIngredientIds();
  return useMemo(
    () => [...seedIngredients, ...userIngredients].filter((i) => !hidden.has(i.id)),
    [userIngredients, hidden],
  );
}

export function findIngredientById(id: string): Ingredient | undefined {
  return getUserIngredients().find((i) => i.id === id) ??
    seedIngredients.find((i) => i.id === id);
}

export function isSeedIngredient(id: string): boolean {
  return seedIngredients.some((i) => i.id === id);
}

export function allIngredientIds(): Set<string> {
  return new Set([
    ...seedIngredients.map((i) => i.id),
    ...getUserIngredients().map((i) => i.id),
  ]);
}
