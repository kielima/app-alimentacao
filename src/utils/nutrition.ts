import { findIngredientById } from '../data/ingredients';
import { findMealById } from '../data/meals';
import { findRecipeById } from '../data/recipes';
import type { NutritionPer100 } from '../types/ingredient';
import type { Meal, MealItem } from '../types/meal';
import type { PlanMealItem } from '../types/mealPlan';
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

function recipePer100g(recipe: Recipe): Partial<Record<keyof NutritionPer100, number>> | null {
  if (recipe.nutrition_per_100g) {
    const direct: Partial<Record<keyof NutritionPer100, number>> = {};
    for (const key of NUTRIENT_KEYS) {
      const v = recipe.nutrition_per_100g[key];
      if (typeof v === 'number') direct[key] = v;
    }
    return direct;
  }
  return recipeNutritionPer100g(recipe);
}

/**
 * Soma nutrição de um item dentro de uma Refeição.
 * `kind === 'recipe'` usa nutrição por 100g da receita; `kind === 'ingredient'`
 * usa nutrição por 100 do ingrediente. Quantity precisa ter unidade g/ml.
 */
function accumulateMealItem(
  item: MealItem,
  totals: Partial<Record<keyof NutritionPer100, number>>,
  skipped: { raw: string; reason: string }[],
): boolean {
  if (item.quantity == null || !item.unit) {
    skipped.push({ raw: `(item ${item.id})`, reason: 'quantidade não informada' });
    return false;
  }
  const base = unitToBase(item.quantity, item.unit);
  if (base === null) {
    skipped.push({ raw: `(item ${item.id})`, reason: `unidade "${item.unit}" sem conversão` });
    return false;
  }
  let per100: Partial<Record<keyof NutritionPer100, number>> | null = null;
  let label = '(item)';
  if (item.kind === 'recipe' && item.recipe_id) {
    const recipe = findRecipeById(item.recipe_id);
    if (!recipe) {
      skipped.push({ raw: item.recipe_id, reason: 'receita não encontrada' });
      return false;
    }
    label = recipe.name;
    per100 = recipePer100g(recipe);
  } else if (item.kind === 'ingredient' && item.ingredient_id) {
    const ing = findIngredientById(item.ingredient_id);
    if (!ing) {
      skipped.push({ raw: item.ingredient_id, reason: 'ingrediente não encontrado' });
      return false;
    }
    label = ing.name;
    if (ing.nutrition_per_100) {
      const cleaned: Partial<Record<keyof NutritionPer100, number>> = {};
      for (const key of NUTRIENT_KEYS) {
        const v = ing.nutrition_per_100[key];
        if (typeof v === 'number') cleaned[key] = v;
      }
      per100 = cleaned;
    }
  } else {
    skipped.push({ raw: `(item ${item.id})`, reason: 'sem vínculo' });
    return false;
  }
  if (!per100) {
    skipped.push({ raw: label, reason: 'sem dados nutricionais' });
    return false;
  }
  const factor = base / 100;
  for (const key of NUTRIENT_KEYS) {
    const v = per100[key];
    if (typeof v === 'number') {
      totals[key] = (totals[key] ?? 0) + v * factor;
    }
  }
  return true;
}

/**
 * Soma nutrição de UMA Refeição (lista de items: receitas + ingredientes diretos).
 */
export function computeMealItemsNutrition(items: MealItem[]): NutritionBreakdown {
  const totals: Partial<Record<keyof NutritionPer100, number>> = {};
  let counted = 0;
  let skipped = 0;
  const skippedReasons: { raw: string; reason: string }[] = [];
  for (const item of items) {
    const ok = accumulateMealItem(item, totals, skippedReasons);
    if (ok) counted++;
    else skipped++;
  }
  return { totals, counted, skipped, skippedReasons };
}

/**
 * Soma nutrição dos itens do plano do dia. Cada PlanMealItem aponta para uma
 * Refeição (Meal); a função expande os itens da Refeição e soma.
 *
 * `meals` é o catálogo completo (seed + user) — passar via hook em React.
 */
export function computePlanItemsNutrition(
  planItems: PlanMealItem[],
  meals: Meal[],
): NutritionBreakdown {
  const totals: Partial<Record<keyof NutritionPer100, number>> = {};
  let counted = 0;
  let skipped = 0;
  const skippedReasons: { raw: string; reason: string }[] = [];

  const byId = new Map(meals.map((m) => [m.id, m]));

  for (const planItem of planItems) {
    if (!planItem.meal_id) {
      skipped++;
      skippedReasons.push({ raw: '(slot)', reason: 'sem refeição selecionada' });
      continue;
    }
    const meal = byId.get(planItem.meal_id) ?? findMealById(planItem.meal_id);
    if (!meal) {
      skipped++;
      skippedReasons.push({ raw: planItem.meal_id, reason: 'refeição não encontrada' });
      continue;
    }
    for (const item of meal.items) {
      const ok = accumulateMealItem(item, totals, skippedReasons);
      if (ok) counted++;
      else skipped++;
    }
  }

  return { totals, counted, skipped, skippedReasons };
}
