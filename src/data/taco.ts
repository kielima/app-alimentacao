import { createFoodMatcher, type FoodEntry, type FoodMatch } from './foodMatch';
import tacoData from './taco.json';

/** Um alimento da Tabela TACO (valores por 100 g da parte comestível). */
export type TacoFood = FoodEntry;

/** Resultado de um casamento por nome contra a TACO. */
export type TacoMatch = FoodMatch;

const FOODS = (tacoData as { foods: TacoFood[] }).foods;

/** Fonte citável (para exibir no ingrediente). */
export const TACO_SOURCE =
  'Tabela Brasileira de Composição de Alimentos (TACO), 4ª ed. — NEPA/UNICAMP';

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

/**
 * Procura o melhor alimento da TACO para um nome de ingrediente.
 * Retorna null quando não há casamento razoável (o chamador cai para TBCA/OFF/IA).
 * A comparação é tolerante (acentos, ordem, sinônimos), mas conservadora: só
 * devolve casamento quando o termo principal bate, evitando preencher errado.
 */
export const findTacoMatch = createFoodMatcher(FOODS, {
  aliases: ALIASES,
  preferredVariety: PREFERRED_VARIETY,
});
