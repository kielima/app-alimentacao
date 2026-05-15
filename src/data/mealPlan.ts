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

export function ensureMealStructure(dayPlan: DayPlan): DayPlan {
  // Garante que todas as meal_types estão presentes (mesmo vazias) na ordem correta.
  const byType = new Map(dayPlan.meals.map((m) => [m.meal_type, m]));
  return {
    ...dayPlan,
    meals: MEAL_TYPES.map((mt) => byType.get(mt.value) ?? emptyMeal(mt.value)),
  };
}

export function newMealItem(): MealItem {
  return {
    id: `meal-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ingredient_id: null,
    raw_text: '',
    quantity: null,
    unit: null,
  };
}
