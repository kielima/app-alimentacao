import type { MealType } from './mealPlan';

export type MealItemKind = 'recipe' | 'ingredient';

/** Referência a uma receita ou ingrediente com quantidade/unidade. Base
 *  compartilhada entre o item principal de uma refeição e suas alternativas. */
export interface MealItemRef {
  kind: MealItemKind;
  recipe_id?: string;
  ingredient_id?: string;
  quantity: number | null;
  unit: string | null;
}

export interface MealItem extends MealItemRef {
  id: string;
  /** Alternativas equivalentes a este item (ex.: iogurte grego OU whey). Cada
   *  uma tem seu próprio tipo/vínculo/quantidade/unidade. */
  substitutes?: MealItemRef[];
  /** Índice em `substitutes` da alternativa em uso. Ausente/null = usar o item
   *  principal (este próprio item). Afeta a nutrição. */
  active_substitute?: number | null;
}

/** Resolve a opção "em uso" de um item de refeição com alternativas. Se
 *  `active_substitute` aponta para uma alternativa válida, retorna-a; caso
 *  contrário retorna o próprio item principal. É por meio dela que a nutrição
 *  segue a escolha do usuário. */
export function activeMealRef(item: MealItem): MealItemRef {
  const subs = item.substitutes;
  const idx = item.active_substitute;
  if (subs && idx != null && idx >= 0 && idx < subs.length) return subs[idx];
  return item;
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
