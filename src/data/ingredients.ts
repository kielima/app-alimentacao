import { useMemo } from 'react';
import seed from '../../seed/ingredients.json';
import type { IngredientsSeed, Ingredient } from '../types/ingredient';
import { getUserIngredients, useUserIngredients } from './userIngredients';

const data = seed as IngredientsSeed;

export const seedIngredients: Ingredient[] = data.ingredients;

// Backward-compat alias (non-reactive, seed only)
export const allIngredients: Ingredient[] = seedIngredients;

export function getAllIngredients(): Ingredient[] {
  return [...seedIngredients, ...getUserIngredients()];
}

export function useAllIngredients(): Ingredient[] {
  const userIngredients = useUserIngredients();
  return useMemo(
    () => [...seedIngredients, ...userIngredients],
    [userIngredients],
  );
}

export function findIngredientById(id: string): Ingredient | undefined {
  return getUserIngredients().find((i) => i.id === id) ??
    seedIngredients.find((i) => i.id === id);
}

export function allIngredientIds(): Set<string> {
  return new Set(getAllIngredients().map((i) => i.id));
}
