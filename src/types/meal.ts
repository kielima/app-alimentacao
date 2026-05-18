import type { MealType } from './mealPlan';

export type MealItemKind = 'recipe' | 'ingredient';

export interface MealItem {
  id: string;
  kind: MealItemKind;
  recipe_id?: string;
  ingredient_id?: string;
  quantity: number | null;
  unit: string | null;
}

export interface Meal {
  id: string;
  name: string;
  /** Lista de slots em que a refeição pode ser usada. Vazio = sem slot. */
  meal_types?: MealType[] | null;
  /** Legado: slot único. Mantido para leitura de dados antigos (seed e localStorage). */
  meal_type?: MealType | null;
  notes?: string;
  items: MealItem[];
}

/** Retorna a lista de slots da refeição, lidando com o formato legado (singular). */
export function getMealSlots(meal: Pick<Meal, 'meal_types' | 'meal_type'>): MealType[] {
  if (meal.meal_types && meal.meal_types.length > 0) return meal.meal_types;
  if (meal.meal_type) return [meal.meal_type];
  return [];
}

export interface MealsSeed {
  meals: Meal[];
}
