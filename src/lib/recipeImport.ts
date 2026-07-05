import { httpsCallable, type FunctionsError } from 'firebase/functions';
import { functions, firebaseConfigured } from './firebase';
import { normalize } from '../utils/search';
import { uniqueSlug } from '../utils/slug';
import { allRecipeIds } from '../data/recipes';
import { getRecipeCategories, DEFAULT_RECIPE_CATEGORIES } from '../data/recipeCategories';
import type { Ingredient } from '../types/ingredient';
import type { Recipe, RecipeIngredient } from '../types/recipe';

// A importação de receitas por link passa por uma Cloud Function
// (extractRecipeFromUrl) que guarda as chaves (Gemini/Apify) no servidor —
// nada de chave no bundle do cliente. Disponível sempre que o Firebase estiver
// configurado.
export const recipeImportConfigured = firebaseConfigured;

/** Um ingrediente cru extraído pela IA (antes de casar com o catálogo). */
export interface ExtractedIngredient {
  raw_text: string;
  name: string | null;
  quantity: number | null;
  unit: string | null;
}

/** Receita bruta devolvida pela Cloud Function. */
export interface ExtractedRecipe {
  found: boolean;
  name: string | null;
  category: string | null;
  prep_time_min: number | null;
  difficulty: 'facil' | 'medio' | 'dificil' | null;
  servings: number | null;
  ingredients: ExtractedIngredient[];
  steps: string[];
  notes: string | null;
  image_url: string | null;
  source_platform: string | null;
  source_url: string | null;
}

type CallInput = { url?: string; text?: string };

/** IDs de categorias válidas no momento (categorias do usuário, com fallback
 *  para as padrão enquanto ainda não foram semeadas). */
function validCategoryIds(): Set<string> {
  const cats = getRecipeCategories();
  const source = cats.length > 0 ? cats : DEFAULT_RECIPE_CATEGORIES;
  return new Set(source.map((c) => c.id));
}

const PLATFORM_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  web: 'página web',
  text: 'texto colado',
};

/** Traduz erros da Cloud Function para mensagens amigáveis. */
function friendlyError(err: unknown): string {
  const fe = err as Partial<FunctionsError> & { message?: string };
  switch (fe?.code) {
    case 'functions/unauthenticated':
      return 'Faça login para importar receitas.';
    case 'functions/permission-denied':
      return 'Sua conta não tem permissão para usar este recurso.';
    case 'functions/resource-exhausted':
      return fe.message || 'Limite de uso atingido. Tente novamente mais tarde.';
    case 'functions/failed-precondition':
      return fe.message || 'Servidor sem as chaves necessárias configuradas.';
    case 'functions/unavailable':
      return fe.message || 'Falha de rede ao ler o link. Tente novamente.';
    case 'functions/not-found':
      return fe.message || 'Não consegui ler o conteúdo desse link.';
    case 'functions/invalid-argument':
      return fe.message || 'Link ou texto inválido.';
    default:
      return fe?.message || 'Falha ao importar a receita. Tente novamente.';
  }
}

/** Normaliza a saída bruta (defensivo: a função pode devolver campos nulos). */
function normalizeExtracted(raw: Partial<ExtractedRecipe>): ExtractedRecipe {
  const category =
    raw.category && validCategoryIds().has(raw.category) ? raw.category : null;
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients
        .filter((i) => i && typeof i.raw_text === 'string' && i.raw_text.trim())
        .map((i) => ({
          raw_text: i.raw_text.trim(),
          name: i.name?.trim() || null,
          quantity: typeof i.quantity === 'number' && Number.isFinite(i.quantity) ? i.quantity : null,
          unit: i.unit?.trim() || null,
        }))
    : [];
  const steps = Array.isArray(raw.steps)
    ? raw.steps.map((s) => String(s).trim()).filter(Boolean)
    : [];
  return {
    found: Boolean(raw.found),
    name: raw.name?.trim() || null,
    category,
    prep_time_min:
      typeof raw.prep_time_min === 'number' && Number.isFinite(raw.prep_time_min)
        ? raw.prep_time_min
        : null,
    difficulty: raw.difficulty ?? null,
    servings:
      typeof raw.servings === 'number' && Number.isFinite(raw.servings) ? raw.servings : null,
    ingredients,
    steps,
    notes: raw.notes?.trim() || null,
    image_url: raw.image_url?.trim() || null,
    source_platform: raw.source_platform?.trim() || null,
    source_url: raw.source_url?.trim() || null,
  };
}

/**
 * Chama a Cloud Function para extrair uma receita de um link ou de texto colado.
 * Lança Error com mensagem amigável em caso de falha.
 */
export async function extractRecipe(input: CallInput): Promise<ExtractedRecipe> {
  if (!functions) {
    throw new Error('Firebase não configurado.');
  }
  const callable = httpsCallable<CallInput, Partial<ExtractedRecipe>>(
    functions,
    'extractRecipeFromUrl',
  );
  try {
    const resp = await callable(input);
    return normalizeExtracted(resp.data ?? {});
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

/** Casa o nome de um ingrediente extraído com um do catálogo (best-effort). */
function matchIngredientId(
  extracted: ExtractedIngredient,
  byName: Map<string, string>,
): string | null {
  const candidate = extracted.name || extracted.raw_text;
  if (!candidate) return null;
  const key = normalize(candidate).trim();
  if (!key) return null;
  // Match exato normalizado primeiro; depois "contém" (o mais curto que casa).
  if (byName.has(key)) return byName.get(key) as string;
  for (const [name, id] of byName) {
    if (name.length >= 3 && key.includes(name)) return id;
  }
  return null;
}

/**
 * Converte a receita extraída para o tipo `Recipe` do app, casando ingredientes
 * com o catálogo existente e marcando `needs_review`. Não persiste — quem chama
 * revisa e depois salva via upsertUserRecipe.
 */
/** Códigos de unidade que os formulários de receita do app usam. */
const APP_UNITS = new Set(['g', 'ml', 'unit', 'xc', 'cs', 'cc', 'dt', 'mç', 'pct', 'a_gosto']);

/** Unidades em texto livre (como a IA devolve) → códigos do app. */
const UNIT_ALIASES: Record<string, string> = {
  g: 'g', grama: 'g', gramas: 'g', gr: 'g',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
  unidade: 'unit', unidades: 'unit', un: 'unit', und: 'unit', unid: 'unit', u: 'unit',
  xicara: 'xc', xicaras: 'xc', xic: 'xc',
  'colher de sopa': 'cs', 'colheres de sopa': 'cs', 'colher sopa': 'cs',
  'colher de cha': 'cc', 'colheres de cha': 'cc', 'colher cha': 'cc',
  dente: 'dt', dentes: 'dt',
  maco: 'mç', macos: 'mç',
  pacote: 'pct', pacotes: 'pct',
  'a gosto': 'a_gosto', 'a criterio': 'a_gosto', qb: 'a_gosto',
};

/**
 * Normaliza a unidade devolvida pela IA para um código do app. Retorna null
 * quando não reconhece — o texto original continua no raw_text, então nada
 * se perde e o usuário pode escolher a unidade na revisão.
 */
function normalizeUnit(raw: string | null): string | null {
  if (!raw) return null;
  if (APP_UNITS.has(raw)) return raw;
  const key = normalize(raw).trim().replace(/\.$/, '');
  return UNIT_ALIASES[key] ?? null;
}

export function extractedToRecipe(
  data: ExtractedRecipe,
  existingIngredients: Ingredient[],
): Recipe {
  const byName = new Map<string, string>();
  for (const ing of existingIngredients) {
    const k = normalize(ing.name).trim();
    if (k && !byName.has(k)) byName.set(k, ing.id);
  }

  const ingredients: RecipeIngredient[] = data.ingredients.map((i) => ({
    raw_text: i.raw_text,
    ingredient_id: matchIngredientId(i, byName),
    quantity: i.quantity,
    unit: normalizeUnit(i.unit),
  }));

  const name = data.name || 'Receita importada';
  const id = uniqueSlug(name, allRecipeIds());

  const platformLabel = data.source_platform
    ? PLATFORM_LABEL[data.source_platform] ?? data.source_platform
    : null;
  const attribution =
    platformLabel && data.source_url
      ? `Importada de ${platformLabel}: ${data.source_url}`
      : platformLabel
        ? `Importada de ${platformLabel}.`
        : null;
  const notes = [data.notes, attribution].filter(Boolean).join('\n\n') || undefined;

  const category = data.category ?? 'pratos-principais';
  return {
    id,
    name,
    category,
    categories: [category],
    prep_time_min: data.prep_time_min,
    difficulty: data.difficulty,
    rating: null,
    photos: data.image_url ? [data.image_url] : [],
    ingredients,
    steps: data.steps,
    notes,
    source_lines: [0, 0],
    needs_review: true,
    source_url: data.source_url ?? undefined,
    source_platform: data.source_platform ?? undefined,
  };
}
