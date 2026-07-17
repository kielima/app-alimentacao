import type { MealType } from './mealPlan';
import type { DispensaStatus } from './dispensaStatus';

export type Unit = 'g' | 'ml' | 'unit';

export type IngredientCategory = string;

export const INGREDIENT_CATEGORIES: { value: IngredientCategory; label: string }[] = [
  { value: 'lacticinios', label: 'Lacticínios' },
  { value: 'hortifruti', label: 'Hortifruti' },
  { value: 'carnes', label: 'Carnes' },
  { value: 'enlatados', label: 'Enlatados' },
];

export function getCategoryLabel(value: string): string {
  const preset = INGREDIENT_CATEGORIES.find((c) => c.value === value);
  return preset?.label ?? value;
}

/** De onde vieram os valores da tabela nutricional de um ingrediente. */
export type NutritionSource = 'photo' | 'taco' | 'tbca' | 'off' | 'ai';

export interface NutritionPer100 {
  calories: number;
  protein: number;
  carbs: number;
  sugars?: number | null;
  fat: number;
  saturated_fat?: number | null;
  fiber?: number | null;
  sodium?: number | null;
}

export interface Ingredient {
  id: string;
  name: string;
  brand?: string | null;
  default_unit: Unit;
  serving_size_g?: number;
  serving_description?: string;
  nutrition_per_100: NutritionPer100 | null;
  extras_per_100?: Record<string, number | null | undefined>;
  ingredients_text?: string;
  allergens?: string;
  source_image?: string;
  needs_review?: boolean;
  notes?: string;
  ceagesp_slug?: string;
  category?: IngredientCategory | null;
  /** Horários em que este ingrediente pode entrar na montagem automática do
   *  plano. Vazio/ausente = serve qualquer horário. */
  meal_types?: MealType[] | null;
  /** `true` = não recomendar nas sugestões do plano (ainda pode ser usado
   *  manualmente e dentro de refeições). */
  no_suggest?: boolean;
  tbca_code?: string;
  taco_id?: string;
  off_barcode?: string;
  /** Origem registada da tabela nutricional (foto/IA além de TACO/TBCA/OFF). */
  nutrition_source?: NutritionSource;
  /** Status na dispensa/lista de compras. Ausente = tratado como 'backlog'. */
  status?: DispensaStatus;
  /** Quantidade atualmente em posse (dispensa) ou a comprar. */
  quantity?: number | null;
  /** Unidade da quantidade em posse. Cai para `default_unit` quando ausente.
   *  Separado de `default_unit` porque a compra pode usar uma unidade diferente
   *  da unidade padrão do ingrediente no catálogo (ex.: comprado em pacote). */
  stock_unit?: string | null;
  expiry_date?: string | null;
  /** Marcado explicitamente como um item que não vence. */
  no_expiry?: boolean;
  /** Mercados/lojas onde o item pode ser comprado (um item pode estar em vários). */
  stores?: string[];
  price?: number | null;
  /** Só relevante com `status: 'comprar'`: já foi comprado, pronto pra mover pra dispensa. */
  checked?: boolean;
}

/** Status efetivo do ingrediente (ausente = 'backlog', dado legado). */
export function ingredientStatus(i: Ingredient): DispensaStatus {
  return i.status ?? 'backlog';
}

/** Unidade da quantidade em posse, com fallback para a unidade padrão do catálogo. */
export function ingredientStockUnit(i: Ingredient): string {
  return i.stock_unit || i.default_unit;
}

/**
 * Resolve a fonte da tabela nutricional. Prefere o campo explícito
 * `nutrition_source`; para dados antigos sem ele, infere de TACO/TBCA/OFF pelo
 * respetivo id. Devolve null quando há tabela sem origem conhecida (ex.: foto/IA
 * gravada antes deste campo existir) — esses casos vão para "Dados a completar".
 */
export function ingredientNutritionSource(i: Ingredient): NutritionSource | null {
  if (i.nutrition_source) return i.nutrition_source;
  if (i.tbca_code) return 'tbca';
  if (i.taco_id) return 'taco';
  if (i.off_barcode) return 'off';
  return null;
}

export interface IngredientsSeed {
  $schema_version: string;
  description: string;
  ingredients: Ingredient[];
  _metadata?: Record<string, unknown>;
}
