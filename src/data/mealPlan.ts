import { createFirestoreStore } from '../utils/createFirestoreStore';
import type {
  DayPlan,
  DayOfWeek,
  PlanType,
  PlanMeal,
  PlanMealItem,
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

function isNewFormatItem(item: unknown): item is PlanMealItem {
  return typeof item === 'object' && item !== null && 'meal_id' in item;
}

export function ensureMealStructure(dayPlan: DayPlan): DayPlan {
  // Garante que todas as meal_types estão presentes (mesmo vazias) na ordem correta.
  // Filtra itens em formato antigo (com recipe_id direto, sem meal_id).
  const byType = new Map(dayPlan.meals.map((m) => [m.meal_type, m]));
  return {
    ...dayPlan,
    meals: MEAL_TYPES.map((mt) => {
      const existing = byType.get(mt.value);
      if (!existing) return emptyPlanMeal(mt.value);
      return { ...existing, items: existing.items.filter(isNewFormatItem) };
    }),
  };
}

export function newPlanMealItem(): PlanMealItem {
  return {
    id: `plan-meal-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    meal_id: null,
    quantity: null,
  };
}
