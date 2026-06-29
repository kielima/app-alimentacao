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

/**
 * Converte uma quantidade na sua unidade para gramas (base do cálculo nutricional).
 *
 * `g`/`ml` são 1:1. As demais medidas (unidade, fatia, xícara, colher, dente,
 * maço, pacote) usam a porção padrão do ingrediente — `serving_size_g`, o peso
 * de 1 daquela medida. Sem porção padrão definida não há como converter → null.
 */
export function quantityToGrams(
  quantity: number | null | undefined,
  unit: string | null | undefined,
  servingSizeG?: number | null,
): number | null {
  if (quantity == null || !unit) return null;
  if (unit === 'g' || unit === 'ml') return quantity;
  if (unit === 'a_gosto') return null;
  if (servingSizeG != null && servingSizeG > 0) return quantity * servingSizeG;
  return null;
}

/** A unidade precisa da porção padrão (g) do ingrediente para virar gramas? */
function needsServingSize(unit: string): boolean {
  return unit !== 'g' && unit !== 'ml' && unit !== 'a_gosto';
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
    const base = quantityToGrams(item.quantity, item.unit, ing.serving_size_g);
    if (base === null) {
      skipped++;
      skippedReasons.push({
        raw: item.raw_text,
        reason: needsServingSize(item.unit)
          ? `defina a porção padrão (g) de "${ing.name}" para usar a unidade "${item.unit}"`
          : `unidade "${item.unit}" sem conversão`,
      });
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
    const ingredient = findIngredientById(ing.ingredient_id);
    if (!ingredient?.nutrition_per_100) continue;
    const base = quantityToGrams(ing.quantity, ing.unit, ingredient.serving_size_g);
    if (base === null) continue;
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
  let per100: Partial<Record<keyof NutritionPer100, number>> | null = null;
  let label = '(item)';
  // Receitas não têm porção padrão (são medidas em g/ml); ingredientes podem ter.
  let servingSizeG: number | null = null;
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
    servingSizeG = ing.serving_size_g ?? null;
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
  if (item.quantity == null || !item.unit) {
    skipped.push({ raw: label, reason: 'quantidade não informada' });
    return false;
  }
  const base = quantityToGrams(item.quantity, item.unit, servingSizeG);
  if (base === null) {
    skipped.push({
      raw: label,
      reason:
        needsServingSize(item.unit) && item.kind === 'ingredient'
          ? `defina a porção padrão (g) de "${label}" para usar a unidade "${item.unit}"`
          : `unidade "${item.unit}" sem conversão`,
    });
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
    if (planItem.kind === 'recipe' || planItem.kind === 'ingredient') {
      // Reutiliza accumulateMealItem tratando o slot do plano como um MealItem.
      const ok = accumulateMealItem(
        {
          id: planItem.id,
          kind: planItem.kind,
          recipe_id: planItem.recipe_id ?? undefined,
          ingredient_id: planItem.ingredient_id ?? undefined,
          quantity: planItem.quantity,
          unit: planItem.unit ?? null,
        },
        totals,
        skippedReasons,
      );
      if (ok) counted++;
      else skipped++;
      continue;
    }
    // kind === 'meal'
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
    // `quantity` de um item do tipo refeição é um multiplicador de porção
    // (1 = porção padrão). O otimizador o ajusta sem mexer na refeição original.
    const portion = planItem.quantity != null && planItem.quantity > 0 ? planItem.quantity : 1;
    const mealTotals: Partial<Record<keyof NutritionPer100, number>> = {};
    for (const item of meal.items) {
      const ok = accumulateMealItem(item, mealTotals, skippedReasons);
      if (ok) counted++;
      else skipped++;
    }
    for (const key of NUTRIENT_KEYS) {
      if (mealTotals[key] !== undefined) {
        totals[key] = (totals[key] ?? 0) + mealTotals[key]! * portion;
      }
    }
  }

  return { totals, counted, skipped, skippedReasons };
}
