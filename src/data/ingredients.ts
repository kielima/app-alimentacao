import { useMemo } from 'react';
import type { Ingredient } from '../types/ingredient';
import { getUserIngredients, useUserIngredients } from './userIngredients';
import { getHiddenIngredientIds, useHiddenIngredientIds } from './hiddenIngredients';

// Catálogo migrado para Firestore (users/{uid}/userIngredients). Sem catálogo base no app.
export const seedIngredients: Ingredient[] = [];
export const allIngredients: Ingredient[] = [];

function applyHidden(list: Ingredient[], hidden: Set<string>): Ingredient[] {
  return hidden.size === 0 ? list : list.filter((i) => !hidden.has(i.id));
}

export function getAllIngredients(): Ingredient[] {
  return applyHidden(getUserIngredients(), getHiddenIngredientIds());
}

export function useAllIngredients(): Ingredient[] {
  const userIngredients = useUserIngredients();
  const hidden = useHiddenIngredientIds();
  return useMemo(() => applyHidden(userIngredients, hidden), [userIngredients, hidden]);
}

export function findIngredientById(id: string): Ingredient | undefined {
  return getUserIngredients().find((i) => i.id === id);
}

export function isSeedIngredient(_id: string): boolean {
  return false;
}

export function allIngredientIds(): Set<string> {
  return new Set(getUserIngredients().map((i) => i.id));
}
