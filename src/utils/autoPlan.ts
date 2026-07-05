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

/** Um item (receita/ingrediente da dispensa) proposto para um horário vazio. */
export interface AutoFillItem {
  /** Chave de seleção única no modal: `${mealType}:${id}`. */
  key: string;
  id: string;
  kind: 'recipe' | 'ingredient';
  label: string;
  quantity: number;
  unit: string;
  /** Macros na porção nominal (as quantidades são equilibradas ao aplicar). */
  macros: Macros;
  earliestDays: number | null;
  expiringConsumed: number;
  /** Item de plano pré-construído (id estável) para aplicar. */
  planItem: PlanMealItem;
}

export interface AutoPlanSlot {
  mealType: MealType;
  meal: Meal | null;
  /** Nº de itens da dispensa vencendo que a refeição escolhida consome. */
  expiringConsumed: number;
  /** Menor validade (dias) entre os itens consumidos; null = nenhum com data. */
  earliestDays: number | null;
  /** Receitas/ingredientes propostos para preencher este horário (quando vazio). */
  fillItems: AutoFillItem[];
}

/** Lacuna do dia (refeições montáveis) em relação à meta. */
export interface DayGap {
  current: Macros;
  /** Proteína (g) faltando para o mínimo (≥ 0). */
  proteinGap: number;
  /** Calorias faltando para a meta, além da tolerância (≥ 0). */
  calorieGap: number;
}

export interface AutoPlanResult {
  /** Plano do dia proposto (só refeições; os `fillItems` entram conforme seleção). */
  dayPlan: DayPlan;
  slots: AutoPlanSlot[];
  /** Total de refeições montáveis no catálogo com a dispensa atual. */
  makeableCount: number;
  /** Quantos horários foram preenchidos por refeições. */
  filledCount: number;
  /** Lacuna do dia vs. meta e resumo para o modal. */
  gap: DayGap;
}

/**
 * Constrói o plano do dia proposto. `pantryExpiryById` mapeia `ingredient_id` →
 * menor validade (dias, via `daysUntil`) na dispensa; suas chaves são a dispensa
 * disponível. Além de posicionar as refeições montáveis, distribui
 * receitas/ingredientes da dispensa pelos **horários vazios** (combos) para
 * ajudar a bater a meta. Não escreve nada — a página aplica com `upsertMealPlan`.
 */
export function buildAutoDayPlan(
  day: DayOfWeek,
  planType: PlanType,
  meals: Meal[],
  recipes: Recipe[],
  ingredients: Ingredient[],
  availability: Map<string, number | null>,
  target: PlanDayTargets,
): AutoPlanResult {
  const pantry = new Set(availability.keys());

  const scored: Scored[] = [];
  for (const meal of meals) {
    const ev = evaluateMeal(meal, pantry);
    if (!ev) continue;
    const { earliest, expiring } = expiryOf(ev.consumed, availability);
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
      slots.push({
        mealType: pm.meal_type,
        meal: null,
        expiringConsumed: 0,
        earliestDays: null,
        fillItems: [],
      });
      return pm;
    }
    used.add(pick.meal.id);
    slots.push({
      mealType: pm.meal_type,
      meal: pick.meal,
      expiringConsumed: pick.expiring,
      earliestDays: pick.earliest,
      fillItems: [],
    });
    const item = { ...newPlanMealItem('meal'), meal_id: pick.meal.id, quantity: 1 };
    return { ...pm, items: [item] };
  });

  // Lacuna do dia com as refeições posicionadas.
  const bd = computePlanItemsNutrition(
    filledMeals.flatMap((m) => m.items),
    meals,
  );
  const current: Macros = {
    calories: numOr0(bd.totals.calories),
    protein: numOr0(bd.totals.protein),
    carbs: numOr0(bd.totals.carbs),
    fat: numOr0(bd.totals.fat),
  };
  const proteinGap = Math.max(0, target.proteinMin - current.protein);
  const rawCal = target.calories - current.calories;
  const calorieGap = rawCal > KCAL_TOLERANCE ? rawCal : 0;
  const gap: DayGap = { current, proteinGap, calorieGap };

  // Distribui receitas/ingredientes da dispensa pelos horários (vazios primeiro,
  // depois complementando os preenchidos) para espalhar em vez de empilhar.
  if (proteinGap > 0 || calorieGap > 0) {
    const ordered = [
      ...slots.filter((s) => s.meal === null),
      ...slots.filter((s) => s.meal !== null),
    ];
    distributeFillItems(ordered, recipes, ingredients, availability, proteinGap, calorieGap);
  }

  return {
    dayPlan: { ...base, meals: filledMeals },
    slots,
    makeableCount: scored.length,
    filledCount: slots.filter((s) => s.meal !== null).length,
    gap,
  };
}

// ── Preenchimento dos horários vazios (combos p/ bater a meta) ──────────────

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

/** Teto de calorias por item sugerido — acima disso, a porção é reduzida para
 *  não propor coisas como 100 g de óleo (900 kcal). */
const CAP_KCAL = 300;

/** Porção nominal de um ingrediente: 1 unidade (medidas contáveis), a porção
 *  padrão (`serving_size_g`) quando houver, ou 100 g/ml. */
function defaultIngredientPortion(ing: Ingredient): { quantity: number; unit: string } {
  if (ing.default_unit === 'unit') return { quantity: 1, unit: 'unit' };
  if (ing.serving_size_g && ing.serving_size_g > 0) {
    return { quantity: ing.serving_size_g, unit: ing.default_unit };
  }
  return { quantity: 100, unit: ing.default_unit };
}

/** Arredonda a quantidade conforme a unidade (g/ml em 5; contáveis em 0,5). */
function roundPortion(q: number, unit: string): number {
  if (unit === 'g' || unit === 'ml') {
    const r = Math.round(q / 5) * 5;
    return r < 5 ? 5 : r;
  }
  const r = Math.round(q * 2) / 2;
  return r < 0.5 ? 0.5 : r;
}

/** Macros na porção base; se passar do teto de kcal, reduz a porção (e recalcula). */
function cappedPortion(
  build: (quantity: number) => PlanMealItem,
  baseQuantity: number,
  unit: string,
): { quantity: number; macros: Macros; counted: number } {
  const base = planItemMacros(build(baseQuantity));
  if (base.counted === 0 || base.macros.calories <= CAP_KCAL) {
    return { quantity: baseQuantity, macros: base.macros, counted: base.counted };
  }
  const scaled = roundPortion((baseQuantity * CAP_KCAL) / base.macros.calories, unit);
  const capped = planItemMacros(build(scaled));
  return { quantity: scaled, macros: capped.macros, counted: capped.counted };
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

/** Horários elegíveis de um item (vazio = serve qualquer horário). */
function slotsFor(item: { meal_types?: MealType[] | null }): MealType[] {
  return item.meal_types ?? [];
}

const eligibleForSlot = (slots: MealType[], mt: MealType): boolean =>
  slots.length === 0 || slots.includes(mt);

/** Item dominado por proteína (≥40% das kcal) — mesma heurística do otimizador. */
const ANCHOR_PROTEIN_SHARE = 0.4;
function isAnchor(m: Macros): boolean {
  return m.calories > 0 && (m.protein * 4) / m.calories >= ANCHOR_PROTEIN_SHARE;
}

interface Candidate {
  id: string;
  kind: 'recipe' | 'ingredient';
  label: string;
  quantity: number;
  unit: string;
  macros: Macros;
  isAnchor: boolean;
  earliestDays: number | null;
  expiringConsumed: number;
  /** Horários etiquetados; vazio = qualquer horário. */
  slots: MealType[];
}

/** Receitas montáveis + ingredientes disponíveis na dispensa, com macros na
 *  porção nominal, flag de âncora, validade e horários elegíveis. */
function collectCandidates(
  recipes: Recipe[],
  ingredients: Ingredient[],
  availability: Map<string, number | null>,
): Candidate[] {
  const pantry = new Set(availability.keys());
  const out: Candidate[] = [];

  for (const ing of ingredients) {
    if (!availability.has(ing.id)) continue;
    if (ing.no_suggest) continue; // marcado "não recomendar"
    // Não sugere gordura quase pura (óleos/temperos) como item isolado: muito
    // calórica e sem proteína — só faz sentido dentro de receitas.
    const n = ing.nutrition_per_100;
    if (n && numOr0(n.calories) >= 700 && numOr0(n.protein) <= 5) continue;
    const { quantity: baseQty, unit } = defaultIngredientPortion(ing);
    const { quantity, macros, counted } = cappedPortion(
      (q) => ({ id: `c-${ing.id}`, kind: 'ingredient', ingredient_id: ing.id, quantity: q, unit }),
      baseQty,
      unit,
    );
    if (counted === 0) continue;
    const { earliest, expiring } = expiryOf([ing.id], availability);
    out.push({
      id: ing.id,
      kind: 'ingredient',
      label: ing.brand ? `${ing.brand} — ${ing.name}` : ing.name,
      quantity,
      unit,
      macros,
      isAnchor: isAnchor(macros),
      earliestDays: earliest,
      expiringConsumed: expiring,
      slots: slotsFor(ing),
    });
  }

  for (const recipe of recipes) {
    if (recipe.no_suggest) continue; // marcado "não recomendar"
    const consumed = new Set<string>();
    const makeable = refSatisfiable(
      { kind: 'recipe', recipe_id: recipe.id, quantity: null, unit: null },
      pantry,
      consumed,
    );
    if (!makeable) continue;
    const { quantity, macros, counted } = cappedPortion(
      (q) => ({ id: `c-${recipe.id}`, kind: 'recipe', recipe_id: recipe.id, quantity: q, unit: 'g' }),
      100,
      'g',
    );
    if (counted === 0) continue;
    const { earliest, expiring } = expiryOf(consumed, availability);
    out.push({
      id: recipe.id,
      kind: 'recipe',
      label: recipe.name,
      quantity,
      unit: 'g',
      macros,
      isAnchor: isAnchor(macros),
      earliestDays: earliest,
      expiringConsumed: expiring,
      slots: slotsFor(recipe),
    });
  }

  return out;
}

/** Constrói o AutoFillItem (com PlanMealItem de id estável) para um candidato. */
function toFillItem(c: Candidate, mealType: MealType): AutoFillItem {
  const planItem: PlanMealItem = {
    ...newPlanMealItem(c.kind),
    recipe_id: c.kind === 'recipe' ? c.id : undefined,
    ingredient_id: c.kind === 'ingredient' ? c.id : undefined,
    quantity: c.quantity,
    unit: c.unit,
  };
  return {
    key: `${mealType}:${c.id}`,
    id: c.id,
    kind: c.kind,
    label: c.label,
    quantity: c.quantity,
    unit: c.unit,
    macros: c.macros,
    earliestDays: c.earliestDays,
    expiringConsumed: c.expiringConsumed,
    planItem,
  };
}

/**
 * Distribui candidatos pelos horários, respeitando as etiquetas de horário.
 * Espalha em vez de empilhar: percorre os slots em rodadas (round-robin),
 * adicionando 1 item por slot a cada rodada até cobrir a lacuna do dia
 * (proteína/calorias). Enquanto falta proteína, prioriza âncoras; depois,
 * acompanhamentos para as calorias. `orderedSlots` vem com os vazios primeiro,
 * então eles têm prioridade, mas os preenchidos também podem receber
 * complementos. Sem cap fixo por horário. As quantidades são equilibradas
 * depois, ao aplicar (otimizador).
 */
function distributeFillItems(
  orderedSlots: AutoPlanSlot[],
  recipes: Recipe[],
  ingredients: Ingredient[],
  availability: Map<string, number | null>,
  proteinGap: number,
  calorieGap: number,
): void {
  const candidates = collectCandidates(recipes, ingredients, availability);
  if (candidates.length === 0 || orderedSlots.length === 0) return;

  const usedIds = new Set<string>();
  const byExpiry = (a: Candidate, b: Candidate) =>
    (a.earliestDays ?? Number.POSITIVE_INFINITY) - (b.earliestDays ?? Number.POSITIVE_INFINITY);

  let remProtein = proteinGap;
  let remCal = calorieGap;
  let progressed = true;

  while ((remProtein > 0.5 || remCal > 5) && progressed) {
    progressed = false;
    for (const slot of orderedSlots) {
      if (remProtein <= 0.5 && remCal <= 5) break;
      const mt = slot.mealType;
      const pool = candidates.filter(
        (c) => !usedIds.has(c.id) && eligibleForSlot(c.slots, mt),
      );
      if (pool.length === 0) continue;

      let pick: Candidate;
      if (remProtein > 0.5) {
        // Prioriza âncoras (maior proteína); se não houver, o melhor proteico.
        const anchors = pool.filter((c) => c.isAnchor);
        pick = (anchors.length ? anchors : pool).sort(
          (a, b) => b.macros.protein - a.macros.protein || byExpiry(a, b),
        )[0];
      } else {
        // Só calorias: acompanhamentos (maior caloria; validade desempata).
        pick = pool.sort((a, b) => b.macros.calories - a.macros.calories || byExpiry(a, b))[0];
      }

      usedIds.add(pick.id);
      slot.fillItems.push(toFillItem(pick, mt));
      remProtein -= pick.macros.protein;
      remCal -= pick.macros.calories;
      progressed = true;
    }
  }
}
