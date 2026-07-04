/** IDs das categorias padrão. As categorias são editáveis/criáveis pelo usuário,
 *  então `Recipe.category` é `string`; este union serve apenas de referência
 *  para as categorias semeadas por padrão. */
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
  /** Alternativas equivalentes a este ingrediente (ex.: leite em pó OU whey).
   *  Cada uma tem seu próprio vínculo/quantidade/unidade. */
  substitutes?: RecipeIngredient[];
  /** Índice em `substitutes` da alternativa em uso. Ausente/null = usar o
   *  ingrediente principal (este próprio item). Afeta nutrição, dispensa e
   *  lista de compras. */
  active_substitute?: number | null;
}

export interface Recipe {
  id: string;
  name: string;
  /** ID da categoria (editável pelo usuário — pode ser um dos padrões ou uma
   *  categoria criada por ele). */
  category: string;
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
  id: string;
  name: string;
  icon: string;
  /** Ordem de exibição (menor primeiro). */
  order?: number;
}

export interface RecipesSeed {
  $schema_version: string;
  description: string;
  categories: RecipeCategoryDef[];
  recipes: Recipe[];
  _metadata?: Record<string, unknown>;
}
