import { findIngredientById } from '../data/ingredients';
import { findMealById } from '../data/meals';
import { findRecipeById } from '../data/recipes';
import type { Meal } from '../types/meal';
import type {
  MealType,
  PlanMeal,
  PlanMealItem,
  PlanMealItemKind,
} from '../types/mealPlan';
import { KCAL_TOLERANCE, type PlanDayTargets } from './profileTargets';
import {
  computeMealItemsNutrition,
  computePlanItemsNutrition,
  quantityToGrams,
  recipeNutritionPer100g,
} from './nutrition';

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

/** Fator máximo de ajuste por item — acima disso, uma troca faz mais sentido. */
const MAX_SCALE = 6;
/** Refeições inteiras escalam menos (não faz sentido comer 6× o almoço). */
const MAX_MEAL_SCALE = 4;

/** Item dominado por proteína (≥40% das kcal) vira "âncora"; o resto, "alavanca". */
const ANCHOR_PROTEIN_SHARE = 0.4;

export interface OptimizedItem {
  itemId: string;
  mealType: MealType;
  label: string;
  kind: PlanMealItemKind;
  /** Unidade exibida: 'g'/'ml', a medida do item, ou '×' para multiplicador de refeição. */
  unit: string | null;
  locked: boolean;
  lockReason?: string;
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

function scaleMacros(m: Macros, f: number): Macros {
  return { calories: m.calories * f, protein: m.protein * f, carbs: m.carbs * f, fat: m.fat * f };
}

function add(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

function macrosFromTotals(totals: Partial<Record<string, number>>): Macros {
  return {
    calories: num(totals.calories),
    protein: num(totals.protein),
    carbs: num(totals.carbs),
    fat: num(totals.fat),
  };
}

/** Nutrição por 100 g/ml de um ingrediente ou receita; null se indisponível. */
function per100ForItem(item: PlanMealItem): Macros | null {
  if (item.kind === 'ingredient' && item.ingredient_id) {
    const n = findIngredientById(item.ingredient_id)?.nutrition_per_100;
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
    return catalogById.get(item.meal_id)?.name ?? findMealById(item.meal_id)?.name ?? 'Refeição';
  }
  return '(item)';
}

/** Macros de um único item do plano, usando o motor de nutrição existente. */
function itemMacros(item: PlanMealItem, catalog: Meal[]): Macros {
  return macrosFromTotals(computePlanItemsNutrition([item], catalog).totals);
}

const roundGrams = (q: number): number => {
  if (q <= 0) return 0;
  const r = Math.round(q / 5) * 5;
  return r < 5 ? 5 : r;
};
const roundCount = (q: number): number => {
  if (q <= 0) return 0;
  const r = Math.round(q * 2) / 2;
  return r < 0.5 ? 0.5 : r;
};
const roundMultiplier = (q: number): number => {
  if (q <= 0) return 0;
  const r = Math.round(q * 20) / 20;
  return r < 0.25 ? 0.25 : r;
};

interface Work {
  ref: OptimizedItem;
  /** Macros por 1 unidade de `q` (1 g, 1 medida, ou 1× da porção da refeição). */
  unitMacros: Macros;
  q0: number;
  q: number;
  anchor: boolean;
  maxQ: number;
  round: (q: number) => number;
}

/**
 * Constrói o estado ajustável de um item do plano. Retorna null se o item não
 * for ajustável (e empurra o motivo no array de bloqueados).
 */
function buildWork(
  item: PlanMealItem,
  mealType: MealType,
  label: string,
  catalog: Meal[],
): Work | { locked: OptimizedItem } {
  const unit = item.unit ?? null;
  const lockedItem = (lockReason: string): { locked: OptimizedItem } => {
    const macros = itemMacros(item, catalog);
    return {
      locked: {
        itemId: item.id,
        mealType,
        label,
        kind: item.kind,
        unit,
        locked: true,
        lockReason,
        currentQuantity: item.quantity,
        suggestedQuantity: item.quantity,
        before: macros,
        after: macros,
      },
    };
  };

  // Refeição composta → escala por multiplicador de porção (não-destrutivo).
  if (item.kind === 'meal') {
    const meal = item.meal_id ? findMealById(item.meal_id) : undefined;
    if (!meal) return lockedItem('refeição não encontrada');
    const mealMacros = macrosFromTotals(computeMealItemsNutrition(meal.items).totals);
    if (mealMacros.calories <= 0) {
      return lockedItem('sem dados nutricionais (itens da refeição sem porção/quantidade)');
    }
    const q0 = item.quantity != null && item.quantity > 0 ? item.quantity : 1;
    return makeWork(item, mealType, label, mealMacros, q0, '×', roundMultiplier, q0 * MAX_MEAL_SCALE);
  }

  // Ingrediente ou receita → escala a própria quantidade na sua unidade.
  const per100 = per100ForItem(item);
  if (!per100) return lockedItem('sem dados nutricionais');
  if (item.quantity == null) return lockedItem('sem quantidade');
  // Receitas só convertem em g/ml; ingredientes usam a porção padrão para outras medidas.
  const servingSizeG =
    item.kind === 'ingredient' && item.ingredient_id
      ? (findIngredientById(item.ingredient_id)?.serving_size_g ?? null)
      : null;
  const gramsPerUnit = quantityToGrams(1, unit, servingSizeG);
  if (gramsPerUnit == null) {
    return lockedItem(
      item.kind === 'ingredient' && unit && unit !== 'g' && unit !== 'ml'
        ? `defina a porção padrão (g) para usar a unidade "${unit}"`
        : `unidade "${unit ?? '—'}" não escalável`,
    );
  }
  const unitMacros = scaleMacros(per100, gramsPerUnit / 100);
  const round = unit === 'g' || unit === 'ml' ? roundGrams : roundCount;
  return makeWork(item, mealType, label, unitMacros, item.quantity, unit, round, item.quantity * MAX_SCALE);
}

function makeWork(
  item: PlanMealItem,
  mealType: MealType,
  label: string,
  unitMacros: Macros,
  q0: number,
  unit: string | null,
  round: (q: number) => number,
  maxQ: number,
): Work {
  const anchor =
    unitMacros.calories > 0 && (unitMacros.protein * 4) / unitMacros.calories >= ANCHOR_PROTEIN_SHARE;
  const before = scaleMacros(unitMacros, q0);
  const ref: OptimizedItem = {
    itemId: item.id,
    mealType,
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
  return { ref, unitMacros, q0, q: q0, anchor, maxQ: maxQ || q0, round };
}

/**
 * Ajusta as quantidades dos itens do dia para bater a meta calórica, mantendo a
 * proteína total ≥ mínimo.
 *
 * Prioridades (espelham as regras do plano):
 *  1. Calorias = alvo principal (tolerância ±KCAL_TOLERANCE).
 *  2. Proteína = restrição obrigatória (nunca abaixo do mínimo).
 *  3. Carbo/gordura = alavancas: itens não-proteicos são escalados primeiro
 *     para fechar a diferença calórica sem mexer nas fontes de proteína.
 *
 * Itens ajustáveis: ingredientes/receitas com nutrição (escalam a própria
 * quantidade) e refeições compostas (escalam por multiplicador de porção).
 * Itens sem dados nutricionais entram como contribuição fixa.
 */
export function optimizeDayPlan(
  meals: PlanMeal[],
  catalog: Meal[],
  target: PlanDayTargets,
  doneMealTypes?: Set<MealType>,
): OptimizeResult {
  const catalogById = new Map(catalog.map((m) => [m.id, m]));
  const work: Work[] = [];
  const lockedItems: OptimizedItem[] = [];
  let lockedTotals: Macros = { ...ZERO };
  let doneLockedCount = 0;

  for (const meal of meals) {
    const isDone = doneMealTypes?.has(meal.meal_type) ?? false;
    for (const item of meal.items) {
      const label = labelForItem(item, catalogById);
      if (isDone) {
        const macros = itemMacros(item, catalog);
        const lockedItem: OptimizedItem = {
          itemId: item.id,
          mealType: meal.meal_type,
          label,
          kind: item.kind,
          unit: item.unit ?? null,
          locked: true,
          lockReason: 'refeição já marcada como feita',
          currentQuantity: item.quantity,
          suggestedQuantity: item.quantity,
          before: macros,
          after: macros,
        };
        lockedItems.push(lockedItem);
        lockedTotals = add(lockedTotals, lockedItem.before);
        doneLockedCount += 1;
        continue;
      }
      const built = buildWork(item, meal.meal_type, label, catalog);
      if ('locked' in built) {
        lockedItems.push(built.locked);
        lockedTotals = add(lockedTotals, built.locked.before);
      } else {
        work.push(built);
      }
    }
  }

  const anchors = work.filter((w) => w.anchor);
  const levers = work.filter((w) => !w.anchor);

  const sumKcal = (list: Work[]) => list.reduce((s, w) => s + w.unitMacros.calories * w.q, 0);
  const sumProtein = (list: Work[]) => list.reduce((s, w) => s + w.unitMacros.protein * w.q, 0);
  const scaleClamped = (w: Work, factor: number) => {
    w.q = Math.min(w.q * factor, w.maxQ);
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
    w.q = w.round(w.q);
    w.ref.suggestedQuantity = w.q;
    w.ref.after = scaleMacros(w.unitMacros, w.q);
  }

  const allItems = [...work.map((w) => w.ref), ...lockedItems];
  const before = allItems.reduce((s, i) => add(s, i.before), { ...ZERO });
  const after = allItems.reduce((s, i) => add(s, i.after), { ...ZERO });

  const meetsCalories = Math.abs(after.calories - target.calories) <= KCAL_TOLERANCE;
  const meetsProtein = after.protein >= target.proteinMin - 0.5;

  const changed = work
    .map((w) => w.ref)
    .filter((i) => i.suggestedQuantity !== i.currentQuantity);

  const notes: string[] = [];
  if (doneLockedCount > 0) {
    notes.push(
      doneLockedCount === 1
        ? '1 item de uma refeição já marcada como feita foi mantido sem alteração (mas conta para o total do dia).'
        : `${doneLockedCount} itens de refeições já marcadas como feitas foram mantidos sem alteração (mas contam para o total do dia).`,
    );
  }
  if (work.length === 0) {
    notes.push(
      doneLockedCount > 0
        ? 'Nenhum item ajustável fora das refeições já marcadas. Desmarque uma refeição para poder ajustá-la.'
        : 'Nenhum item ajustável neste dia. Verifique se os ingredientes têm dados nutricionais e ' +
            'porção padrão (g), e se os itens das refeições têm quantidade — só assim dá para calcular e ajustar.',
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
        `Faltam ${Math.abs(diff)} kcal para a meta: os itens ajustáveis chegaram ao limite de aumento. ` +
          'Ajuste de quantidade sozinho não basta — considere 1 troca (SUGESTÃO DE TROCA).',
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
