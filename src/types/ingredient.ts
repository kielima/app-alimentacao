export type Unit = 'g' | 'ml' | 'unit';

export type IngredientCategory = 'lacticinios' | 'hortifruti' | 'carnes' | 'enlatados';

export const INGREDIENT_CATEGORIES: { value: IngredientCategory; label: string }[] = [
  { value: 'lacticinios', label: 'Lacticínios' },
  { value: 'hortifruti', label: 'Hortifruti' },
  { value: 'carnes', label: 'Carnes' },
  { value: 'enlatados', label: 'Enlatados' },
];

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
  tbca_code?: string;
  off_barcode?: string;
}

export interface IngredientsSeed {
  $schema_version: string;
  description: string;
  ingredients: Ingredient[];
  _metadata?: Record<string, unknown>;
}
