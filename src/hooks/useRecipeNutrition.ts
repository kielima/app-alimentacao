import { useMemo } from 'react';
import type { Recipe } from '../types/recipe';
import { activeIngredient, computeNutrition, type NutritionBreakdown } from '../utils/nutrition';

export function useRecipeNutrition(recipe: Recipe | undefined): NutritionBreakdown | null {
  return useMemo(() => {
    if (!recipe) return null;
    const items = [...(recipe.ingredients ?? []), ...(recipe.ingredients_molho ?? [])].map(
      activeIngredient,
    );
    if (items.length === 0) return null;
    return computeNutrition(items);
  }, [recipe]);
}
