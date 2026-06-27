export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type PlanType = 'training_day' | 'rest_day';
export type MealType =
  | 'cafe-manha'
  | 'lanche-manha'
  | 'almoco'
  | 'pre-treino'
  | 'pos-treino'
  | 'lanche-tarde'
  | 'jantar'
  | 'ceia';

export type PlanMealItemKind = 'meal' | 'recipe' | 'ingredient';

export interface PlanMealItem {
  id: string;
  kind: PlanMealItemKind;
  meal_id?: string | null;
  recipe_id?: string | null;
  ingredient_id?: string | null;
  quantity: number | null;
  unit?: string | null;
}

export interface PlanMeal {
  meal_type: MealType;
  items: PlanMealItem[];
}

export interface DayPlan {
  id: string;
  day_of_week: DayOfWeek;
  plan_type: PlanType;
  meals: PlanMeal[];
}

export const DAYS_OF_WEEK: { value: DayOfWeek; label: string; short: string }[] = [
  { value: 0, label: 'Segunda-feira', short: 'Seg' },
  { value: 1, label: 'Terça-feira', short: 'Ter' },
  { value: 2, label: 'Quarta-feira', short: 'Qua' },
  { value: 3, label: 'Quinta-feira', short: 'Qui' },
  { value: 4, label: 'Sexta-feira', short: 'Sex' },
  { value: 5, label: 'Sábado', short: 'Sáb' },
  { value: 6, label: 'Domingo', short: 'Dom' },
];

// `icon` é o nome de um glifo do componente <Icon /> (não mais emoji).
export const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: 'cafe-manha', label: 'Café da Manhã', icon: 'coffee' },
  { value: 'lanche-manha', label: 'Lanche da Manhã', icon: 'sandwich' },
  { value: 'almoco', label: 'Almoço', icon: 'salad' },
  { value: 'pre-treino', label: 'Pré-Treino', icon: 'dumbbell' },
  { value: 'pos-treino', label: 'Pós-Treino', icon: 'zap' },
  { value: 'lanche-tarde', label: 'Lanche da Tarde', icon: 'cup-soda' },
  { value: 'jantar', label: 'Jantar', icon: 'utensils' },
  { value: 'ceia', label: 'Ceia', icon: 'moon' },
];

// Quais refeições aparecem em cada variante do plano, em ordem. Sincronizado com
// o treino do dia no app de Ritual: em dia de TREINO (training_day) há pré e
// pós-treino; em DESCANSO (rest_day) entra o "lanche da tarde" no lugar deles. As
// demais (café, lanche da manhã, almoço, jantar, ceia) aparecem nas duas.
const REFEICOES_COMUNS: MealType[] = ['cafe-manha', 'lanche-manha', 'almoco'];
const REFEICOES_FIM: MealType[] = ['jantar', 'ceia'];

export function mealTypesForPlan(plan: PlanType): MealType[] {
  const tarde: MealType[] =
    plan === 'rest_day' ? ['lanche-tarde'] : ['pre-treino', 'pos-treino'];
  return [...REFEICOES_COMUNS, ...tarde, ...REFEICOES_FIM];
}

/**
 * Converte JS Date.getDay() (0=Sunday) para nosso DayOfWeek (0=Monday).
 */
export function todayDayOfWeek(): DayOfWeek {
  const jsDay = new Date().getDay();
  return ((jsDay + 6) % 7) as DayOfWeek;
}

export function planKey(day: DayOfWeek, plan: PlanType): string {
  return `${day}-${plan}`;
}
