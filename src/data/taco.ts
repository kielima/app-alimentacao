import type { NutritionPer100 } from '../types/ingredient';
import { normalize } from '../utils/search';
import tacoData from './taco.json';

/** Um alimento da Tabela TACO (valores por 100 g da parte comestível). */
export interface TacoFood {
  id: string;
  name: string;
  category: string | null;
  nutrition_per_100: NutritionPer100;
  extras_per_100?: Record<string, number>;
}

/** Resultado de um casamento por nome contra a TACO. */
export interface TacoMatch {
  food: TacoFood;
  /** 'high' = nome praticamente idêntico; 'medium' = casamento parcial confiável. */
  confidence: 'high' | 'medium';
}

const FOODS = (tacoData as { foods: TacoFood[] }).foods;

/** Fonte citável (para exibir no ingrediente). */
export const TACO_SOURCE =
  'Tabela Brasileira de Composição de Alimentos (TACO), 4ª ed. — NEPA/UNICAMP';

// Palavras que não ajudam a distinguir alimentos. "comum"/"normal"/"simples"
// são qualificadores genéricos ("batata comum") que a TACO não usa.
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'e', 'em', 'ao', 'a', 'o',
  'tipo', 'the', 'of', 'comum', 'normal', 'simples',
]);

// Variedade padrão quando o ingrediente cita só o alimento base, sem qualificar.
// Ex.: "batata" (comum) na TACO é a "batata, inglesa" — não a baroa (mandioquinha)
// nem a doce. Aplicado como leve desempate; um qualificador explícito ("batata
// doce") sempre vence, pois casa mais tokens.
const PREFERRED_VARIETY: Record<string, string> = {
  batata: 'inglesa',
};

// Sinônimos/regionalismos → termo usado na TACO (já normalizados, sem acento).
const ALIASES: Record<string, string> = {
  kabocha: 'cabotian',
  cabotia: 'cabotian',
  japonesa: 'cabotian',
  aipim: 'mandioca',
  macaxeira: 'mandioca',
  mexerica: 'tangerina',
  bergamota: 'tangerina',
  tomatinho: 'tomate',
  vagem: 'feijao',
};

/** Divide um texto normalizado em tokens de conteúdo (aplica sinônimos). */
function tokenize(normalized: string): string[] {
  return normalized
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .map((t) => ALIASES[t] ?? t);
}

// Pré-computa os tokens de cada alimento uma vez.
const INDEX = FOODS.map((food) => {
  const tokens = tokenize(normalize(food.name));
  return { food, tokens, tokenSet: new Set(tokens) };
});

/**
 * Procura o melhor alimento da TACO para um nome de ingrediente.
 * Retorna null quando não há casamento razoável (o chamador cai para OFF/IA).
 * A comparação é tolerante (acentos, ordem, sinônimos), mas conservadora: só
 * devolve casamento quando o termo principal bate, evitando preencher errado.
 */
export function findTacoMatch(name: string, _brand?: string | null): TacoMatch | null {
  const queryTokens = tokenize(normalize(name));
  if (queryTokens.length === 0) return null;
  const primary = queryTokens[0];

  let best: { food: TacoFood; score: number; coverage: number; extra: number } | null = null;

  for (const { food, tokens, tokenSet } of INDEX) {
    // O termo principal do ingrediente precisa aparecer no alimento.
    if (!tokenSet.has(primary)) continue;
    // E o alimento PRINCIPAL da TACO (1º token, ex.: "Frango" em
    // "Frango, com açafrão") precisa ter sido nomeado no ingrediente. Sem isso,
    // "Açafrão" casaria com "Frango, com açafrão" só por conter a palavra.
    if (!queryTokens.includes(tokens[0])) continue;

    const matched = queryTokens.filter((t) => tokenSet.has(t)).length;
    const coverage = matched / queryTokens.length;
    if (coverage < 0.5) continue;

    const isRaw = tokenSet.has('cru') || tokenSet.has('crua');
    const extra = tokens.filter((t) => !queryTokens.includes(t)).length;
    // Na TACO o alimento principal vem primeiro ("Leite, de vaca, integral").
    // Priorizar quando o termo principal do ingrediente é o 1º token evita casar
    // "Leite integral" com "Canjica, com leite integral".
    const mainNoun = tokens[0] === primary ? 2 : 0;
    // Sem variedade citada, prefere a padrão (ex.: "batata" → "inglesa"), para
    // não cair numa variedade arbitrária ("baroa") só por ordem alfabética.
    const preferred = PREFERRED_VARIETY[primary] && tokenSet.has(PREFERRED_VARIETY[primary]) ? 1.5 : 0;

    // Mais tokens em comum é melhor; empata a favor da versão "crua" (genérica)
    // e da que tem menos descritores sobrando.
    const score = matched * 3 + mainNoun + preferred + (isRaw ? 1 : 0) - extra * 0.25;

    if (!best || score > best.score || (score === best.score && extra < best.extra)) {
      best = { food, score, coverage, extra };
    }
  }

  if (!best) return null;

  const exact = normalize(best.food.name).replace(/[^a-z0-9]+/g, ' ').trim() ===
    normalize(name).replace(/[^a-z0-9]+/g, ' ').trim();
  const confidence: 'high' | 'medium' =
    exact || (best.coverage === 1 && best.extra <= 1) ? 'high' : 'medium';

  return { food: best.food, confidence };
}
