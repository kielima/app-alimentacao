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
import { MEAL_TYPES, planKey } from '../types/mealPlan';

const store = createFirestoreStore<DayPlan>('app-alimentacao:meal-plan', 'mealPlan');

export const getMealPlans = store.getAll;
export const getMealPlanByKey = (day: DayOfWeek, plan: PlanType): DayPlan | undefined =>
  store.getById(planKey(day, plan));
export const upsertMealPlan = store.upsert;
export const useMealPlans = store.useAll;

export function emptyPlanMeal(meal_type: MealType): PlanMeal {
  return { meal_type, items: [] };
}

export function emptyDayPlan(day: DayOfWeek, plan: PlanType): DayPlan {
  return {
    id: planKey(day, plan),
    day_of_week: day,
    plan_type: plan,
    meals: MEAL_TYPES.map((mt) => emptyPlanMeal(mt.value)),
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
  // Garante que todas as meal_types estão presentes (mesmo vazias) na ordem correta.
  // Migra itens em formato antigo (sem `kind`) para o novo formato com kind: 'meal'.
  const byType = new Map(dayPlan.meals.map((m) => [m.meal_type, m]));
  return {
    ...dayPlan,
    meals: MEAL_TYPES.map((mt) => {
      const existing = byType.get(mt.value);
      if (!existing) return emptyPlanMeal(mt.value);
      const items = existing.items
        .map(migrateItem)
        .filter((it): it is PlanMealItem => it !== null);
      return { ...existing, items };
    }),
  };
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
