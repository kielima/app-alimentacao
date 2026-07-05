import type { MealType } from './mealPlan';

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
  /** Ingrediente dispensável — a receita funciona sem ele (ex.: guarnição,
   *  finalização). Ausente/false = obrigatório. */
  is_optional?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  /** ID da categoria principal (editável pelo usuário — pode ser um dos padrões
   *  ou uma categoria criada por ele). Mantido por compatibilidade; espelha o
   *  primeiro item de `categories`. Prefira `recipeCategoryIds`/`primaryCategoryId`. */
  category: string;
  /** IDs de todas as categorias da receita. Uma receita pode pertencer a mais de
   *  uma categoria. Quando ausente/vazio, cai no campo legado `category`. */
  categories?: string[];
  /** Horários em que esta receita pode entrar na montagem automática do plano.
   *  Vazio/ausente = serve qualquer horário. */
  meal_types?: MealType[] | null;
  /** `true` = não recomendar nas sugestões do plano (ainda pode ser usada
   *  manualmente e dentro de refeições). */
  no_suggest?: boolean;
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

/** IDs das categorias de uma receita, normalizados. Usa `categories` quando
 *  presente e não-vazio; caso contrário cai no campo legado `category`. */
export function recipeCategoryIds(r: Pick<Recipe, 'category' | 'categories'>): string[] {
  if (r.categories && r.categories.length > 0) return r.categories;
  return r.category ? [r.category] : [];
}

/** Categoria principal (primeira) — usada onde só cabe uma (agrupamento, ícone). */
export function primaryCategoryId(r: Pick<Recipe, 'category' | 'categories'>): string {
  return recipeCategoryIds(r)[0] ?? '';
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
