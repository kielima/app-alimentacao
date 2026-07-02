export type RecipeCategoryId =
  | 'pratos-principais'
  | 'bebidas'
  | 'sobremesas-e-lanches'
  | 'molhos-temperos-acompanhamentos';

export type Difficulty = 'facil' | 'medio' | 'dificil';
export type Season = 'verao' | 'outono' | 'inverno' | 'primavera';
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface RecipeIngredient {
  raw_text: string;
  ingredient_id: string | null;
  quantity: number | null;
  unit: string | null;
}

export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategoryId;
  prep_time_min?: number | null;
  difficulty?: Difficulty | null;
  rating?: Rating | null;
  photos?: string[];
  ingredients?: RecipeIngredient[];
  ingredients_molho?: RecipeIngredient[];
  steps?: string[];
  steps_natural?: string[];
  steps_congelada?: string[];
  source_lines: [number, number];
  notes?: string;
  season?: Season;
  needs_review?: boolean;
  nutrition_per_100g?: Record<string, number | null>;
  /** URL de origem quando a receita foi importada de um link (TikTok, YouTube, web…). */
  source_url?: string;
  /** Plataforma de origem: 'youtube' | 'tiktok' | 'instagram' | 'web' | 'text'. */
  source_platform?: string;
}

export interface RecipeCategoryDef {
  id: RecipeCategoryId;
  name: string;
  icon: string;
}

export interface RecipesSeed {
  $schema_version: string;
  description: string;
  categories: RecipeCategoryDef[];
  recipes: Recipe[];
  _metadata?: Record<string, unknown>;
}
