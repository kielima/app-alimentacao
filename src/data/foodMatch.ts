import type { NutritionPer100 } from '../types/ingredient';
import { normalize } from '../utils/search';

/**
 * Um alimento de uma tabela de composição (TACO ou TBCA), valores por 100 g da
 * parte comestível. Forma comum partilhada pelas duas bases locais.
 */
export interface FoodEntry {
  id: string;
  name: string;
  category: string | null;
  nutrition_per_100: NutritionPer100;
  extras_per_100?: Record<string, number>;
}

/** Resultado de um casamento por nome contra uma tabela. */
export interface FoodMatch {
  food: FoodEntry;
  /** 'high' = nome praticamente idêntico; 'medium' = casamento parcial confiável. */
  confidence: 'high' | 'medium';
}

/** Ajustes de vocabulário específicos de cada tabela. */
export interface MatchConfig {
  /** Sinônimos/regionalismos → termo usado na tabela (normalizados, sem acento). */
  aliases?: Record<string, string>;
  /** Variedade padrão quando o ingrediente cita só o alimento base. */
  preferredVariety?: Record<string, string>;
}

// Palavras que não ajudam a distinguir alimentos. "comum"/"normal"/"simples"
// são qualificadores genéricos ("batata comum") que as tabelas não usam.
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'e', 'em', 'ao', 'a', 'o',
  'tipo', 'the', 'of', 'comum', 'normal', 'simples',
]);

/** Divide um texto normalizado em tokens de conteúdo (aplica sinônimos). */
function tokenize(normalized: string, aliases: Record<string, string>): string[] {
  return normalized
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .map((t) => aliases[t] ?? t);
}

/**
 * Cria um matcher tolerante por tokens para uma tabela de alimentos. O índice de
 * tokens é pré-computado uma vez (no closure). O matcher é conservador: só
 * devolve casamento quando o termo principal bate, evitando preencher errado.
 */
export function createFoodMatcher(foods: FoodEntry[], config: MatchConfig = {}) {
  const aliases = config.aliases ?? {};
  const preferredVariety = config.preferredVariety ?? {};

  // Pré-computa os tokens de cada alimento uma vez.
  const index = foods.map((food) => {
    const tokens = tokenize(normalize(food.name), aliases);
    return { food, tokens, tokenSet: new Set(tokens) };
  });

  return function findMatch(name: string, _brand?: string | null): FoodMatch | null {
    const queryTokens = tokenize(normalize(name), aliases);
    if (queryTokens.length === 0) return null;
    const primary = queryTokens[0];

    let best: { food: FoodEntry; score: number; coverage: number; extra: number } | null = null;

    for (const { food, tokens, tokenSet } of index) {
      // O termo principal do ingrediente precisa aparecer no alimento.
      if (!tokenSet.has(primary)) continue;
      // E o alimento PRINCIPAL da tabela (1º token, ex.: "Frango" em
      // "Frango, com açafrão") precisa ter sido nomeado no ingrediente. Sem isso,
      // "Açafrão" casaria com "Frango, com açafrão" só por conter a palavra.
      if (!queryTokens.includes(tokens[0])) continue;

      const matched = queryTokens.filter((t) => tokenSet.has(t)).length;
      const coverage = matched / queryTokens.length;
      if (coverage < 0.5) continue;

      const isRaw = tokenSet.has('cru') || tokenSet.has('crua');
      const extra = tokens.filter((t) => !queryTokens.includes(t)).length;
      // Na tabela o alimento principal vem primeiro ("Leite, de vaca, integral").
      // Priorizar quando o termo principal do ingrediente é o 1º token evita casar
      // "Leite integral" com "Canjica, com leite integral".
      const mainNoun = tokens[0] === primary ? 2 : 0;
      // Sem variedade citada, prefere a padrão (ex.: "batata" → "inglesa"), para
      // não cair numa variedade arbitrária ("baroa") só por ordem alfabética.
      const preferred =
        preferredVariety[primary] && tokenSet.has(preferredVariety[primary]) ? 1.5 : 0;

      // Mais tokens em comum é melhor; empata a favor da versão "crua" (genérica)
      // e da que tem menos descritores sobrando.
      const score = matched * 3 + mainNoun + preferred + (isRaw ? 1 : 0) - extra * 0.25;

      if (!best || score > best.score || (score === best.score && extra < best.extra)) {
        best = { food, score, coverage, extra };
      }
    }

    if (!best) return null;

    const exact =
      normalize(best.food.name).replace(/[^a-z0-9]+/g, ' ').trim() ===
      normalize(name).replace(/[^a-z0-9]+/g, ' ').trim();
    const confidence: 'high' | 'medium' =
      exact || (best.coverage === 1 && best.extra <= 1) ? 'high' : 'medium';

    return { food: best.food, confidence };
  };
}
