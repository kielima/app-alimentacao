import { createFirestoreStore } from '../utils/createFirestoreStore';
import type { DayPlan, DayOfWeek, PlanType, Meal, MealItem, MealType } from '../types/mealPlan';
import { MEAL_TYPES, planKey } from '../types/mealPlan';

const store = createFirestoreStore<DayPlan>('app-alimentacao:meal-plan', 'mealPlan');

export const getMealPlans = store.getAll;
export const getMealPlanByKey = (day: DayOfWeek, plan: PlanType): DayPlan | undefined =>
  store.getById(planKey(day, plan));
export const upsertMealPlan = store.upsert;
export const useMealPlans = store.useAll;

export function emptyMeal(meal_type: MealType): Meal {
  return { meal_type, items: [] };
}

export function emptyDayPlan(day: DayOfWeek, plan: PlanType): DayPlan {
  return {
    id: planKey(day, plan),
    day_of_week: day,
    plan_type: plan,
    meals: MEAL_TYPES.map((mt) => emptyMeal(mt.value)),
  };
}

function isNewFormatItem(item: unknown): item is MealItem {
  return typeof item === 'object' && item !== null && 'recipe_id' in item;
}

export function ensureMealStructure(dayPlan: DayPlan): DayPlan {
  // Garante que todas as meal_types estão presentes (mesmo vazias) na ordem correta.
  // Filtra itens em formato antigo (com ingredient_id, sem recipe_id).
  const byType = new Map(dayPlan.meals.map((m) => [m.meal_type, m]));
  return {
    ...dayPlan,
    meals: MEAL_TYPES.map((mt) => {
      const existing = byType.get(mt.value);
      if (!existing) return emptyMeal(mt.value);
      return { ...existing, items: existing.items.filter(isNewFormatItem) };
    }),
  };
}

export function newMealItem(): MealItem {
  return {
    id: `meal-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    recipe_id: null,
    quantity: null,
  };
}
