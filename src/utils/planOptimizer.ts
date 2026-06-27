import { findIngredientById } from '../data/ingredients';
import { findRecipeById } from '../data/recipes';
import type { Meal } from '../types/meal';
import type {
  MealType,
  PlanMeal,
  PlanMealItem,
  PlanMealItemKind,
} from '../types/mealPlan';
import { KCAL_TOLERANCE, type PlanDayTargets } from './profileTargets';
import { computePlanItemsNutrition, recipeNutritionPer100g } from './nutrition';

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

/** Itens só são escaláveis em massa/volume (a nutrição é linear em g/ml). */
const SCALABLE_UNITS = new Set(['g', 'ml']);

/** Fator máximo de ajuste por item — acima disso, uma troca faz mais sentido. */
const MAX_SCALE = 6;

/** Item dominado por proteína (≥40% das kcal) vira "âncora"; o resto, "alavanca". */
const ANCHOR_PROTEIN_SHARE = 0.4;

export interface OptimizedItem {
  itemId: string;
  mealType: MealType;
  label: string;
  kind: PlanMealItemKind;
  unit: string | null;
  locked: boolean;
  lockReason?: string;
  /** Apenas para itens ajustáveis: âncora (proteína) ou alavanca (carbo/gordura). */
  role?: 'anchor' | 'lever';
  currentQuantity: number | null;
  suggestedQuantity: number | null;
  before: Macros;
  after: Macros;
}

export interface OptimizeResult {
  target: PlanDayTargets;
  before: Macros;
  after: Macros;
  items: OptimizedItem[];
  changed: OptimizedItem[];
  meetsCalories: boolean;
  meetsProtein: boolean;
  adjustableCount: number;
  notes: string[];
}

function num(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function macrosAt(per100: Macros, grams: number): Macros {
  const f = grams / 100;
  return {
    calories: per100.calories * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f,
  };
}

function add(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

/** Nutrição por 100 g/ml de um item de ingrediente ou receita; null se indisponível. */
function per100ForItem(item: PlanMealItem): Macros | null {
  if (item.kind === 'ingredient' && item.ingredient_id) {
    const ing = findIngredientById(item.ingredient_id);
    const n = ing?.nutrition_per_100;
    if (!n) return null;
    return { calories: num(n.calories), protein: num(n.protein), carbs: num(n.carbs), fat: num(n.fat) };
  }
  if (item.kind === 'recipe' && item.recipe_id) {
    const r = findRecipeById(item.recipe_id);
    if (!r) return null;
    const src = r.nutrition_per_100g ?? recipeNutritionPer100g(r);
    if (!src) return null;
    return { calories: num(src.calories), protein: num(src.protein), carbs: num(src.carbs), fat: num(src.fat) };
  }
  return null;
}

function labelForItem(item: PlanMealItem, catalogById: Map<string, Meal>): string {
  if (item.kind === 'ingredient' && item.ingredient_id) {
    const ing = findIngredientById(item.ingredient_id);
    if (ing) return ing.brand ? `${ing.brand} — ${ing.name}` : ing.name;
    return 'Ingrediente';
  }
  if (item.kind === 'recipe' && item.recipe_id) {
    return findRecipeById(item.recipe_id)?.name ?? 'Receita';
  }
  if (item.kind === 'meal' && item.meal_id) {
    return catalogById.get(item.meal_id)?.name ?? 'Refeição';
  }
  return '(item)';
}

/** Macros de um único item do plano, usando o motor de nutrição existente. */
function itemMacros(item: PlanMealItem, catalog: Meal[]): Macros {
  const b = computePlanItemsNutrition([item], catalog);
  return {
    calories: num(b.totals.calories),
    protein: num(b.totals.protein),
    carbs: num(b.totals.carbs),
    fat: num(b.totals.fat),
  };
}

function roundQty(grams: number): number {
  if (grams <= 0) return 0;
  const r = Math.round(grams / 5) * 5;
  return r < 5 ? 5 : r;
}

interface Work {
  ref: OptimizedItem;
  per100: Macros;
  q0: number;
  q: number;
  anchor: boolean;
}

/**
 * Ajusta as quantidades (g/ml) dos itens ajustáveis do dia para bater a meta
 * calórica, mantendo a proteína total ≥ mínimo.
 *
 * Prioridades (espelham as regras do plano):
 *  1. Calorias = alvo principal (tolerância ±KCAL_TOLERANCE).
 *  2. Proteína = restrição obrigatória (nunca abaixo do mínimo).
 *  3. Carbo/gordura = alavancas: itens não-proteicos são escalados primeiro
 *     para fechar a diferença calórica sem mexer nas fontes de proteína.
 *
 * Itens não ajustáveis (refeições compostas, unidades ≠ g/ml, sem dados
 * nutricionais) entram no total como contribuição fixa.
 */
export function optimizeDayPlan(
  meals: PlanMeal[],
  catalog: Meal[],
  target: PlanDayTargets,
): OptimizeResult {
  const catalogById = new Map(catalog.map((m) => [m.id, m]));
  const work: Work[] = [];
  const lockedItems: OptimizedItem[] = [];
  let lockedTotals: Macros = { ...ZERO };

  for (const meal of meals) {
    for (const item of meal.items) {
      const label = labelForItem(item, catalogById);
      const unit = item.unit ?? null;
      const per100 = per100ForItem(item);

      let lockReason: string | undefined;
      if (item.kind === 'meal') lockReason = 'refeição composta (quantidade fixa)';
      else if (item.quantity == null) lockReason = 'sem quantidade';
      else if (!unit || !SCALABLE_UNITS.has(unit)) lockReason = `unidade "${unit ?? '—'}" não escalável`;
      else if (!per100) lockReason = 'sem dados nutricionais';

      if (lockReason || !per100) {
        const macros = itemMacros(item, catalog);
        lockedTotals = add(lockedTotals, macros);
        lockedItems.push({
          itemId: item.id,
          mealType: meal.meal_type,
          label,
          kind: item.kind,
          unit,
          locked: true,
          lockReason: lockReason ?? 'não ajustável',
          currentQuantity: item.quantity,
          suggestedQuantity: item.quantity,
          before: macros,
          after: macros,
        });
        continue;
      }

      const q0 = item.quantity as number;
      const anchor = per100.calories > 0 && (per100.protein * 4) / per100.calories >= ANCHOR_PROTEIN_SHARE;
      const before = macrosAt(per100, q0);
      const ref: OptimizedItem = {
        itemId: item.id,
        mealType: meal.meal_type,
        label,
        kind: item.kind,
        unit,
        locked: false,
        role: anchor ? 'anchor' : 'lever',
        currentQuantity: q0,
        suggestedQuantity: q0,
        before,
        after: before,
      };
      work.push({ ref, per100, q0, q: q0, anchor });
    }
  }

  const anchors = work.filter((w) => w.anchor);
  const levers = work.filter((w) => !w.anchor);

  const sumKcal = (list: Work[]) => list.reduce((s, w) => s + (w.per100.calories * w.q) / 100, 0);
  const sumProtein = (list: Work[]) => list.reduce((s, w) => s + (w.per100.protein * w.q) / 100, 0);
  const scaleClamped = (w: Work, factor: number) => {
    w.q = Math.min(w.q * factor, w.q0 * MAX_SCALE || w.q * factor);
  };

  const proteinFloor = Math.max(0, target.proteinMin - lockedTotals.protein);
  const kcalTarget = Math.max(0, target.calories - lockedTotals.calories);

  // Passo 1 — garantir o piso de proteína escalando âncoras para cima.
  const raiseProtein = () => {
    const pNow = sumProtein(work);
    if (pNow >= proteinFloor - 0.01 || anchors.length === 0) return;
    const aP = sumProtein(anchors);
    if (aP <= 0) return;
    const need = proteinFloor - (pNow - aP); // proteína exigida das âncoras
    const f = need / aP;
    if (f > 1) anchors.forEach((w) => scaleClamped(w, f));
  };
  raiseProtein();

  // Passo 2 — fechar a meta calórica usando as alavancas (carbo/gordura).
  const gap = kcalTarget - sumKcal(work);
  const leverKcal = sumKcal(levers);
  if (Math.abs(gap) > 0.5 && leverKcal > 0) {
    let f = (leverKcal + gap) / leverKcal;
    if (f < 0) f = 0;
    levers.forEach((w) => scaleClamped(w, f));
  } else if (Math.abs(gap) > 0.5 && leverKcal <= 0 && anchors.length > 0) {
    // Sem alavancas: ajustar âncoras, mas nunca abaixo do piso de proteína.
    const aKcal = sumKcal(anchors);
    const aP = sumProtein(anchors);
    if (aKcal > 0) {
      let f = (aKcal + gap) / aKcal;
      const leverP = sumProtein(levers);
      const minF = aP > 0 ? Math.max(0, (proteinFloor - leverP) / aP) : 0;
      f = Math.max(minF, Math.max(0, f));
      anchors.forEach((w) => scaleClamped(w, f));
    }
  }

  // Passo 3 — se cortar alavancas derrubou a proteína, recompor com âncoras.
  raiseProtein();

  // Arredonda e materializa o resultado.
  for (const w of work) {
    w.q = roundQty(w.q);
    w.ref.suggestedQuantity = w.q;
    w.ref.after = macrosAt(w.per100, w.q);
  }

  const sumItems = (list: OptimizedItem[], pick: (i: OptimizedItem) => Macros) =>
    list.reduce((s, i) => add(s, pick(i)), { ...ZERO });
  const allItems = [...work.map((w) => w.ref), ...lockedItems];
  const before = sumItems(allItems, (i) => i.before);
  const after = sumItems(allItems, (i) => i.after);

  const meetsCalories = Math.abs(after.calories - target.calories) <= KCAL_TOLERANCE;
  const meetsProtein = after.protein >= target.proteinMin - 0.5;

  const changed = work
    .map((w) => w.ref)
    .filter((i) => i.suggestedQuantity !== i.currentQuantity);

  const notes: string[] = [];
  if (work.length === 0) {
    notes.push(
      'Nenhum item ajustável neste dia (são refeições compostas, sem unidade g/ml ou sem ' +
        'dados nutricionais). Lance os itens como ingrediente/receita em g/ml para o ajuste automático.',
    );
  }
  if (!meetsProtein) {
    notes.push(
      `Proteína final ${after.protein.toFixed(0)} g abaixo do mínimo (${target.proteinMin} g): ` +
        'os itens ajustáveis não têm proteína suficiente. Considere adicionar/trocar por uma fonte proteica (SUGESTÃO DE TROCA).',
    );
  }
  if (!meetsCalories) {
    const diff = Math.round(after.calories - target.calories);
    if (diff < 0) {
      notes.push(
        `Faltam ${Math.abs(diff)} kcal para a meta: os itens ajustáveis chegaram ao limite de aumento ` +
          `(até ${MAX_SCALE}× a porção). Ajuste de quantidade sozinho não basta — considere 1 troca (SUGESTÃO DE TROCA).`,
      );
    } else {
      notes.push(
        `${diff} kcal acima da meta: os itens ajustáveis não comportam redução suficiente sem ` +
          'furar o piso de proteína. Considere trocar um item calórico por outro mais leve (SUGESTÃO DE TROCA).',
      );
    }
  }

  return {
    target,
    before,
    after,
    items: allItems,
    changed,
    meetsCalories,
    meetsProtein,
    adjustableCount: work.length,
    notes,
  };
}
