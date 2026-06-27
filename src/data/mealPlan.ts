import { createFirestoreStore } from '../utils/createFirestoreStore';
import type {
  DayPlan,
  DayOfWeek,
  PlanType,
  PlanMeal,
  PlanMealItem,
  PlanMealItemKind,
  MealType,
} from '../types/mealPlan';
import { mealTypesForPlan, planKey } from '../types/mealPlan';

const store = createFirestoreStore<DayPlan>('app-alimentacao:meal-plan', 'mealPlan');

export const getMealPlans = store.getAll;
export const getMealPlanByKey = (day: DayOfWeek, plan: PlanType): DayPlan | undefined =>
  store.getById(planKey(day, plan));
export const upsertMealPlan = store.upsert;
export const replaceMealPlans = store.replace;
export const useMealPlans = store.useAll;

export function emptyPlanMeal(meal_type: MealType): PlanMeal {
  return { meal_type, items: [] };
}

export function emptyDayPlan(day: DayOfWeek, plan: PlanType): DayPlan {
  return {
    id: planKey(day, plan),
    day_of_week: day,
    plan_type: plan,
    meals: mealTypesForPlan(plan).map((mt) => emptyPlanMeal(mt)),
  };
}

function migrateItem(item: unknown): PlanMealItem | null {
  if (typeof item !== 'object' || item === null) return null;
  const raw = item as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id : null;
  if (!id) return null;
  const quantity = typeof raw.quantity === 'number' ? raw.quantity : null;
  const unit = typeof raw.unit === 'string' ? raw.unit : null;
  // Já no formato novo
  if (raw.kind === 'meal' || raw.kind === 'recipe' || raw.kind === 'ingredient') {
    return {
      id,
      kind: raw.kind,
      meal_id: typeof raw.meal_id === 'string' ? raw.meal_id : null,
      recipe_id: typeof raw.recipe_id === 'string' ? raw.recipe_id : null,
      ingredient_id: typeof raw.ingredient_id === 'string' ? raw.ingredient_id : null,
      quantity,
      unit,
    };
  }
  // Migração: formato antigo (apenas meal_id) → kind: 'meal'
  if ('meal_id' in raw) {
    return {
      id,
      kind: 'meal',
      meal_id: typeof raw.meal_id === 'string' ? raw.meal_id : null,
      quantity,
    };
  }
  return null;
}

export function ensureMealStructure(dayPlan: DayPlan): DayPlan {
  // Garante as meal_types da VARIANTE (training_day/rest_day) presentes (mesmo
  // vazias) na ordem correta. Migra itens em formato antigo (sem `kind`).
  const byType = new Map(dayPlan.meals.map((m) => [m.meal_type, m]));
  const tipos = mealTypesForPlan(dayPlan.plan_type);
  const meals: PlanMeal[] = tipos.map((mt) => {
    const existing = byType.get(mt);
    if (!existing) return emptyPlanMeal(mt);
    const items = existing.items
      .map(migrateItem)
      .filter((it): it is PlanMealItem => it !== null);
    return { ...existing, items };
  });
  // Não perder dados: refeições FORA da variante que já tenham itens cadastrados
  // continuam aparecendo (ex.: pré-treino preenchido num plano de descanso).
  for (const m of dayPlan.meals) {
    if (tipos.includes(m.meal_type)) continue;
    const items = m.items
      .map(migrateItem)
      .filter((it): it is PlanMealItem => it !== null);
    if (items.length > 0) meals.push({ ...m, items });
  }
  return { ...dayPlan, meals };
}

export function newPlanMealItem(kind: PlanMealItemKind = 'meal'): PlanMealItem {
  return {
    id: `plan-meal-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    meal_id: kind === 'meal' ? null : undefined,
    recipe_id: kind === 'recipe' ? null : undefined,
    ingredient_id: kind === 'ingredient' ? null : undefined,
    quantity: null,
    unit: null,
  };
}
