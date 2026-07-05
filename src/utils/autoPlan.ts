import { findRecipeById } from '../data/recipes';
import { emptyDayPlan, newPlanMealItem } from '../data/mealPlan';
import { daysUntil } from './expiry';
import { computePlanItemsNutrition } from './nutrition';
import { KCAL_TOLERANCE, type PlanDayTargets } from './profileTargets';
import type { Macros } from './planOptimizer';
import { getMealSlots, type Meal, type MealItem, type MealItemRef } from '../types/meal';
import type { Recipe, RecipeIngredient } from '../types/recipe';
import type { Ingredient } from '../types/ingredient';
import type { PantryItem } from '../types/pantry';
import type { DayOfWeek, DayPlan, MealType, PlanMealItem, PlanType } from '../types/mealPlan';

/** Dias para uma validade contar como "vencendo" (espelha SOON_DAYS de expiry.ts). */
const SOON_DAYS = 3;

export interface PantryAvailability {
  /** ingredient_id → menor validade (dias) entre os itens NÃO vencidos; null =
   *  só há itens sem data. As chaves são o conjunto disponível para montar. */
  available: Map<string, number | null>;
  /** Nº de ingredientes que só têm itens vencidos (ficaram de fora). */
  expiredOnly: number;
}

/**
 * Deriva a disponibilidade da dispensa para a montagem do plano, aplicando a
 * validade: um item **vencido** (validade < hoje) não conta como disponível.
 * Itens sem data e futuros contam. Guarda a menor validade não vencida por
 * ingrediente para alimentar a priorização por vencimento de `buildAutoDayPlan`.
 *
 * Só considera comida (`kind !== 'household'`) com `ingredient_id`, seguindo o
 * casamento por id usado no resto do app.
 */
export function pantryAvailability(items: PantryItem[]): PantryAvailability {
  const available = new Map<string, number | null>();
  // Ingredientes vistos (para saber quais só têm itens vencidos).
  const seen = new Set<string>();
  for (const item of items) {
    if (item.kind === 'household' || !item.ingredient_id) continue;
    seen.add(item.ingredient_id);
    const d = daysUntil(item.expiry_date);
    if (d !== null && d < 0) continue; // vencido → não conta como disponível
    const id = item.ingredient_id;
    if (!available.has(id)) available.set(id, d);
    else {
      const prev = available.get(id) ?? null;
      // Guarda a menor validade (mais urgente); "sem data" é menos urgente.
      if (d !== null && (prev == null || d < prev)) available.set(id, d);
    }
  }
  let expiredOnly = 0;
  for (const id of seen) if (!available.has(id)) expiredOnly++;
  return { available, expiredOnly };
}

/**
 * Monta o plano do dia automaticamente a partir da dispensa: para cada horário,
 * escolhe a melhor refeição *montável* (todos os ingredientes disponíveis),
 * priorizando as que consomem itens perto do vencimento.
 *
 * Regra de disponibilidade: um ingrediente conta como disponível quando seu
 * `ingredient_id` está na dispensa — apenas presença, como já faz a tela de
 * receita (ignora quantidade/validade na checagem). Ingredientes sem vínculo
 * (`ingredient_id` null, ex.: sal/água/"a gosto") são ignorados, não bloqueiam.
 * Substitutos contam como alternativas (basta UM disponível).
 */

/** Uma variante (principal ou substituto) está satisfeita? Registra em `consumed`
 *  os `ingredient_id` da dispensa efetivamente usados (para pontuar por validade). */
function refSatisfiable(ref: MealItemRef, pantry: Set<string>, consumed: Set<string>): boolean {
  if (ref.kind === 'ingredient') {
    if (!ref.ingredient_id) return true; // não vinculado → ignorado
    if (pantry.has(ref.ingredient_id)) {
      consumed.add(ref.ingredient_id);
      return true;
    }
    return false;
  }
  // kind === 'recipe' → expande e exige todos os ingredientes da receita.
  if (!ref.recipe_id) return false;
  const recipe = findRecipeById(ref.recipe_id);
  if (!recipe) return false;
  const ings = [...(recipe.ingredients ?? []), ...(recipe.ingredients_molho ?? [])];
  for (const ing of ings) {
    if (!recipeIngredientSatisfiable(ing, pantry, consumed)) return false;
  }
  return true;
}

/** Ingrediente de receita: satisfeito se o principal OU um substituto estiver na
 *  dispensa; ou se alguma variante for não vinculada (ignorada). */
function recipeIngredientSatisfiable(
  ing: RecipeIngredient,
  pantry: Set<string>,
  consumed: Set<string>,
): boolean {
  const variants = [ing, ...(ing.substitutes ?? [])];
  let hasUnlinked = false;
  for (const v of variants) {
    if (!v.ingredient_id) {
      hasUnlinked = true;
      continue;
    }
    if (pantry.has(v.ingredient_id)) {
      consumed.add(v.ingredient_id);
      return true;
    }
  }
  return hasUnlinked;
}

/** Item da refeição: satisfeito se o principal OU qualquer substituto for. Usa um
 *  conjunto temporário para não "sujar" `consumed` com variantes que falharam. */
function mealItemSatisfiable(item: MealItem, pantry: Set<string>, consumed: Set<string>): boolean {
  const variants: MealItemRef[] = [item, ...(item.substitutes ?? [])];
  for (const v of variants) {
    const temp = new Set<string>();
    if (refSatisfiable(v, pantry, temp)) {
      for (const id of temp) consumed.add(id);
      return true;
    }
  }
  return false;
}

interface Evaluated {
  meal: Meal;
  consumed: Set<string>;
}

/** Refeição montável = tem itens e todos são satisfazíveis pela dispensa. */
function evaluateMeal(meal: Meal, pantry: Set<string>): Evaluated | null {
  if (meal.items.length === 0) return null;
  const consumed = new Set<string>();
  for (const item of meal.items) {
    if (!mealItemSatisfiable(item, pantry, consumed)) return null;
  }
  return { meal, consumed };
}

interface Scored {
  meal: Meal;
  /** Menor validade (dias) entre os itens da dispensa consumidos; null = nenhum com data. */
  earliest: number | null;
  /** Quantos itens consumidos estão vencendo (≤ SOON_DAYS). */
  expiring: number;
}

/** Melhor primeiro: quem consome item mais próximo do vencimento, depois quem
 *  consome mais itens vencendo, depois nome (estável). */
function compareBestFirst(a: Scored, b: Scored): number {
  const ea = a.earliest ?? Number.POSITIVE_INFINITY;
  const eb = b.earliest ?? Number.POSITIVE_INFINITY;
  if (ea !== eb) return ea - eb;
  if (a.expiring !== b.expiring) return b.expiring - a.expiring;
  return a.meal.name.localeCompare(b.meal.name, 'pt-BR');
}

export interface AutoPlanSlot {
  mealType: MealType;
  meal: Meal | null;
  /** Nº de itens da dispensa vencendo que a refeição escolhida consome. */
  expiringConsumed: number;
  /** Menor validade (dias) entre os itens consumidos; null = nenhum com data. */
  earliestDays: number | null;
}

export interface AutoPlanResult {
  /** Plano do dia proposto (substitui o atual ao aplicar). */
  dayPlan: DayPlan;
  slots: AutoPlanSlot[];
  /** Total de refeições montáveis no catálogo com a dispensa atual. */
  makeableCount: number;
  /** Quantos horários foram preenchidos. */
  filledCount: number;
}

/**
 * Constrói o plano do dia proposto. `pantryExpiryById` mapeia `ingredient_id` →
 * menor validade (dias, via `daysUntil`) na dispensa; suas chaves são a dispensa
 * disponível. Não escreve nada — a página aplica com `upsertMealPlan`.
 */
export function buildAutoDayPlan(
  day: DayOfWeek,
  planType: PlanType,
  meals: Meal[],
  pantryExpiryById: Map<string, number | null>,
): AutoPlanResult {
  const pantry = new Set(pantryExpiryById.keys());

  const scored: Scored[] = [];
  for (const meal of meals) {
    const ev = evaluateMeal(meal, pantry);
    if (!ev) continue;
    let earliest: number | null = null;
    let expiring = 0;
    for (const id of ev.consumed) {
      const d = pantryExpiryById.get(id);
      if (d == null) continue;
      if (earliest === null || d < earliest) earliest = d;
      if (d <= SOON_DAYS) expiring++;
    }
    scored.push({ meal, earliest, expiring });
  }

  const base = emptyDayPlan(day, planType);
  const used = new Set<string>();
  const slots: AutoPlanSlot[] = [];

  const filledMeals = base.meals.map((pm) => {
    const candidates = scored
      .filter((s) => getMealSlots(s.meal).includes(pm.meal_type))
      .sort(compareBestFirst);
    // Evita repetir uma refeição já colocada em outro horário quando houver alternativa.
    const pick = candidates.find((s) => !used.has(s.meal.id)) ?? candidates[0] ?? null;
    if (!pick) {
      slots.push({ mealType: pm.meal_type, meal: null, expiringConsumed: 0, earliestDays: null });
      return pm;
    }
    used.add(pick.meal.id);
    slots.push({
      mealType: pm.meal_type,
      meal: pick.meal,
      expiringConsumed: pick.expiring,
      earliestDays: pick.earliest,
    });
    const item = { ...newPlanMealItem('meal'), meal_id: pick.meal.id, quantity: 1 };
    return { ...pm, items: [item] };
  });

  return {
    dayPlan: { ...base, meals: filledMeals },
    slots,
    makeableCount: scored.length,
    filledCount: slots.filter((s) => s.meal !== null).length,
  };
}

// ── Sugestões para bater a meta ─────────────────────────────────────────────

/** Uma receita ou ingrediente da dispensa sugerido para fechar a lacuna. */
export interface GapSuggestion {
  /** recipe_id ou ingredient_id (também é a chave de seleção no modal). */
  id: string;
  kind: 'recipe' | 'ingredient';
  label: string;
  /** Porção padrão sugerida (afinável depois no plano/otimizador). */
  quantity: number;
  unit: string;
  /** Macros nesta porção. */
  macros: Macros;
  /** Menor validade (dias) entre os itens da dispensa que a sugestão consome. */
  earliestDays: number | null;
  /** Quantos desses itens estão vencendo (≤ SOON_DAYS). */
  expiringConsumed: number;
}

export interface GapFillResult {
  current: Macros;
  /** Proteína (g) ainda faltando para o mínimo (≥ 0). */
  proteinGap: number;
  /** Calorias ainda faltando para a meta, além da tolerância (≥ 0). */
  calorieGap: number;
  suggestions: GapSuggestion[];
}

const numOr0 = (v: number | null | undefined): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;

/** Macros de um único item de plano (receita/ingrediente) numa dada porção. */
function planItemMacros(item: PlanMealItem): { macros: Macros; counted: number } {
  const bd = computePlanItemsNutrition([item], []);
  return {
    macros: {
      calories: numOr0(bd.totals.calories),
      protein: numOr0(bd.totals.protein),
      carbs: numOr0(bd.totals.carbs),
      fat: numOr0(bd.totals.fat),
    },
    counted: bd.counted,
  };
}

/** Porção padrão sugerida para um ingrediente: 1 unidade (medidas contáveis) ou
 *  100 g/ml. */
function defaultIngredientPortion(ing: Ingredient): { quantity: number; unit: string } {
  return ing.default_unit === 'unit'
    ? { quantity: 1, unit: 'unit' }
    : { quantity: 100, unit: ing.default_unit };
}

/** Menor validade (dias) e nº de itens vencendo entre um conjunto de ingredientes
 *  da dispensa consumidos. */
function expiryOf(
  ids: Iterable<string>,
  availability: Map<string, number | null>,
): { earliest: number | null; expiring: number } {
  let earliest: number | null = null;
  let expiring = 0;
  for (const id of ids) {
    const d = availability.get(id);
    if (d == null) continue;
    if (earliest === null || d < earliest) earliest = d;
    if (d <= SOON_DAYS) expiring++;
  }
  return { earliest, expiring };
}

/**
 * Sugere receitas e ingredientes **da dispensa** que ajudam a fechar a lacuna do
 * dia em relação à meta (proteína mínima e calorias). Não escreve nada — a página
 * anexa as sugestões escolhidas ao plano.
 *
 * Prioriza proteína quando ela está abaixo do mínimo; depois, completar calorias.
 * Ignora itens já presentes no plano e itens sem dados nutricionais utilizáveis.
 */
export function suggestGapFillers(
  dayPlan: DayPlan,
  meals: Meal[],
  recipes: Recipe[],
  ingredients: Ingredient[],
  availability: Map<string, number | null>,
  target: PlanDayTargets,
  max = 6,
): GapFillResult {
  const items = dayPlan.meals.flatMap((m) => m.items);
  const bd = computePlanItemsNutrition(items, meals);
  const current: Macros = {
    calories: numOr0(bd.totals.calories),
    protein: numOr0(bd.totals.protein),
    carbs: numOr0(bd.totals.carbs),
    fat: numOr0(bd.totals.fat),
  };

  const proteinGap = Math.max(0, target.proteinMin - current.protein);
  const rawCal = target.calories - current.calories;
  const calorieGap = rawCal > KCAL_TOLERANCE ? rawCal : 0;

  if (proteinGap <= 0 && calorieGap <= 0) {
    return { current, proteinGap: 0, calorieGap: 0, suggestions: [] };
  }

  const pantry = new Set(availability.keys());
  // Itens já no plano não devem ser sugeridos de novo.
  const usedRecipeIds = new Set<string>();
  const usedIngredientIds = new Set<string>();
  for (const it of items) {
    if (it.kind === 'recipe' && it.recipe_id) usedRecipeIds.add(it.recipe_id);
    if (it.kind === 'ingredient' && it.ingredient_id) usedIngredientIds.add(it.ingredient_id);
  }

  const suggestions: GapSuggestion[] = [];

  // Ingredientes disponíveis na dispensa (respeitando validade via `availability`).
  for (const ing of ingredients) {
    if (usedIngredientIds.has(ing.id) || !availability.has(ing.id)) continue;
    const { quantity, unit } = defaultIngredientPortion(ing);
    const { macros, counted } = planItemMacros({
      id: `sug-${ing.id}`,
      kind: 'ingredient',
      ingredient_id: ing.id,
      quantity,
      unit,
    });
    if (counted === 0) continue; // sem dados nutricionais / unidade não conversível
    const { earliest, expiring } = expiryOf([ing.id], availability);
    suggestions.push({
      id: ing.id,
      kind: 'ingredient',
      label: ing.brand ? `${ing.brand} — ${ing.name}` : ing.name,
      quantity,
      unit,
      macros,
      earliestDays: earliest,
      expiringConsumed: expiring,
    });
  }

  // Receitas montáveis com a dispensa (porção padrão de 100 g).
  for (const recipe of recipes) {
    if (usedRecipeIds.has(recipe.id)) continue;
    const consumed = new Set<string>();
    const makeable = refSatisfiable(
      { kind: 'recipe', recipe_id: recipe.id, quantity: null, unit: null },
      pantry,
      consumed,
    );
    if (!makeable) continue;
    const { macros, counted } = planItemMacros({
      id: `sug-${recipe.id}`,
      kind: 'recipe',
      recipe_id: recipe.id,
      quantity: 100,
      unit: 'g',
    });
    if (counted === 0) continue;
    const { earliest, expiring } = expiryOf(consumed, availability);
    suggestions.push({
      id: recipe.id,
      kind: 'recipe',
      label: recipe.name,
      quantity: 100,
      unit: 'g',
      macros,
      earliestDays: earliest,
      expiringConsumed: expiring,
    });
  }

  // Ranqueamento: proteína primeiro quando falta; depois, caloria mais próxima da
  // lacuna. Validade (mais urgente) e nome como desempates estáveis.
  const earliestKey = (s: GapSuggestion) => s.earliestDays ?? Number.POSITIVE_INFINITY;
  suggestions.sort((a, b) => {
    if (proteinGap > 0 && b.macros.protein !== a.macros.protein) {
      return b.macros.protein - a.macros.protein;
    }
    const da = Math.abs(a.macros.calories - calorieGap);
    const db = Math.abs(b.macros.calories - calorieGap);
    if (da !== db) return da - db;
    if (earliestKey(a) !== earliestKey(b)) return earliestKey(a) - earliestKey(b);
    return a.label.localeCompare(b.label, 'pt-BR');
  });

  return { current, proteinGap, calorieGap, suggestions: suggestions.slice(0, max) };
}
