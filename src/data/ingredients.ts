import { useMemo } from 'react';
import seed from '../../seed/ingredients.json';
import type { IngredientsSeed, Ingredient } from '../types/ingredient';
import { getUserIngredients, useUserIngredients } from './userIngredients';
import { getHiddenIngredientIds, useHiddenIngredientIds } from './hiddenIngredients';

const data = seed as IngredientsSeed;

export const seedIngredients: Ingredient[] = data.ingredients;

// Backward-compat alias (non-reactive, seed only)
export const allIngredients: Ingredient[] = seedIngredients;

function mergeIngredients(userIngredients: Ingredient[], hidden: Set<string>): Ingredient[] {
  const userById = new Map(userIngredients.map((i) => [i.id, i]));
  const merged = seedIngredients.map((i) => userById.get(i.id) ?? i);
  for (const u of userIngredients) {
    if (!merged.some((i) => i.id === u.id)) merged.push(u);
  }
  return merged.filter((i) => !hidden.has(i.id));
}

export function getAllIngredients(): Ingredient[] {
  return mergeIngredients(getUserIngredients(), getHiddenIngredientIds());
}

export function useAllIngredients(): Ingredient[] {
  const userIngredients = useUserIngredients();
  const hidden = useHiddenIngredientIds();
  return useMemo(() => mergeIngredients(userIngredients, hidden), [userIngredients, hidden]);
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
