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
  meal_type?: MealType | null;
  notes?: string;
  items: MealItem[];
}

export interface MealsSeed {
  meals: Meal[];
}
