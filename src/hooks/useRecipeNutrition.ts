import { useMemo } from 'react';
import { findIngredientById } from '../data/ingredients';
import type { Recipe, RecipeIngredient } from '../types/recipe';
import type { NutritionPer100 } from '../types/ingredient';

const NUTRIENT_KEYS: (keyof NutritionPer100)[] = [
  'calories',
  'protein',
  'carbs',
  'sugars',
  'fat',
  'saturated_fat',
  'fiber',
  'sodium',
];

export interface NutritionBreakdown {
  totals: Partial<Record<keyof NutritionPer100, number>>;
  counted: number;
  skipped: number;
  skippedReasons: { raw: string; reason: string }[];
}

function unitToBase(quantity: number, unit: string): number | null {
  if (unit === 'g' || unit === 'ml') return quantity;
  return null;
}

function computeFromIngredients(items: RecipeIngredient[]): NutritionBreakdown {
  const totals: Partial<Record<keyof NutritionPer100, number>> = {};
  let counted = 0;
  let skipped = 0;
  const skippedReasons: { raw: string; reason: string }[] = [];

  for (const item of items) {
    if (!item.ingredient_id) {
      skipped++;
      skippedReasons.push({ raw: item.raw_text, reason: 'sem vínculo com ingrediente' });
      continue;
    }
    const ing = findIngredientById(item.ingredient_id);
    if (!ing) {
      skipped++;
      skippedReasons.push({ raw: item.raw_text, reason: 'ingrediente não encontrado' });
      continue;
    }
    if (!ing.nutrition_per_100) {
      skipped++;
      skippedReasons.push({ raw: item.raw_text, reason: 'sem dados nutricionais' });
      continue;
    }
    if (item.quantity === null || !item.unit) {
      skipped++;
      skippedReasons.push({ raw: item.raw_text, reason: 'quantidade não informada' });
      continue;
    }
    const base = unitToBase(item.quantity, item.unit);
    if (base === null) {
      skipped++;
      skippedReasons.push({ raw: item.raw_text, reason: `unidade "${item.unit}" sem conversão` });
      continue;
    }
    const factor = base / 100;
    for (const key of NUTRIENT_KEYS) {
      const v = ing.nutrition_per_100[key];
      if (typeof v === 'number') {
        totals[key] = (totals[key] ?? 0) + v * factor;
      }
    }
    counted++;
  }

  return { totals, counted, skipped, skippedReasons };
}

export function useRecipeNutrition(recipe: Recipe | undefined): NutritionBreakdown | null {
  return useMemo(() => {
    if (!recipe) return null;
    const items = [
      ...(recipe.ingredients ?? []),
      ...(recipe.ingredients_molho ?? []),
    ];
    if (items.length === 0) return null;
    return computeFromIngredients(items);
  }, [recipe]);
}
