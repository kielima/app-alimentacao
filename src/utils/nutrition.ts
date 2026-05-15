import { findIngredientById } from '../data/ingredients';
import { findRecipeById } from '../data/recipes';
import type { NutritionPer100 } from '../types/ingredient';
import type { MealItem } from '../types/mealPlan';
import type { Recipe } from '../types/recipe';

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

export interface NutritionItem {
  raw_text: string;
  ingredient_id: string | null;
  quantity: number | null;
  unit: string | null;
}

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

export function computeNutrition(items: NutritionItem[]): NutritionBreakdown {
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

/**
 * Calcula nutrição da receita por 100g, a partir dos ingredientes vinculados
 * que tenham unidade g/ml e dados nutricionais. Retorna null se não der
 * para computar.
 */
export function recipeNutritionPer100g(
  recipe: Recipe,
): Partial<Record<keyof NutritionPer100, number>> | null {
  if (!recipe.ingredients || recipe.ingredients.length === 0) return null;
  const totals: Partial<Record<keyof NutritionPer100, number>> = {};
  let totalWeight = 0;
  for (const ing of recipe.ingredients) {
    if (!ing.ingredient_id || ing.quantity == null || !ing.unit) continue;
    const base = unitToBase(ing.quantity, ing.unit);
    if (base === null) continue;
    const ingredient = findIngredientById(ing.ingredient_id);
    if (!ingredient?.nutrition_per_100) continue;
    totalWeight += base;
    const factor = base / 100;
    for (const key of NUTRIENT_KEYS) {
      const v = ingredient.nutrition_per_100[key];
      if (typeof v === 'number') {
        totals[key] = (totals[key] ?? 0) + v * factor;
      }
    }
  }
  if (totalWeight === 0) return null;
  const per100g: Partial<Record<keyof NutritionPer100, number>> = {};
  for (const key of NUTRIENT_KEYS) {
    if (totals[key] !== undefined) {
      per100g[key] = (totals[key]! / totalWeight) * 100;
    }
  }
  return per100g;
}

export function computeMealNutrition(items: MealItem[]): NutritionBreakdown {
  const totals: Partial<Record<keyof NutritionPer100, number>> = {};
  let counted = 0;
  let skipped = 0;
  const skippedReasons: { raw: string; reason: string }[] = [];

  for (const item of items) {
    if (!item.recipe_id) {
      skipped++;
      skippedReasons.push({ raw: '(item)', reason: 'sem receita selecionada' });
      continue;
    }
    const recipe = findRecipeById(item.recipe_id);
    if (!recipe) {
      skipped++;
      skippedReasons.push({ raw: item.recipe_id, reason: 'receita não encontrada' });
      continue;
    }
    if (item.quantity == null) {
      skipped++;
      skippedReasons.push({ raw: recipe.name, reason: 'quantidade não informada' });
      continue;
    }
    let per100g: Partial<Record<keyof NutritionPer100, number>> | null = null;
    if (recipe.nutrition_per_100g) {
      per100g = {};
      for (const key of NUTRIENT_KEYS) {
        const v = recipe.nutrition_per_100g[key];
        if (typeof v === 'number') per100g[key] = v;
      }
    } else {
      per100g = recipeNutritionPer100g(recipe);
    }
    if (!per100g) {
      skipped++;
      skippedReasons.push({ raw: recipe.name, reason: 'sem dados nutricionais' });
      continue;
    }
    const factor = item.quantity / 100;
    for (const key of NUTRIENT_KEYS) {
      const v = per100g[key];
      if (typeof v === 'number') {
        totals[key] = (totals[key] ?? 0) + v * factor;
      }
    }
    counted++;
  }

  return { totals, counted, skipped, skippedReasons };
}
