import { createFoodMatcher, type FoodEntry, type FoodMatch } from './foodMatch';

/** Um alimento da TBCA (valores por 100 g da parte comestível). */
export type TbcaFood = FoodEntry;

/** Resultado de um casamento por nome contra a TBCA. */
export type TbcaMatch = FoodMatch;

/** Fonte citável (para exibir no ingrediente). */
export const TBCA_SOURCE =
  'Tabela Brasileira de Composição de Alimentos (TBCA) — USP/FoRC';

// A TBCA tem ~5.500 alimentos (~2 MB). Carrega o JSON e constrói o índice só na
// 1ª consulta (autofill é sob demanda), mantendo-o fora do bundle inicial.
let matcher: ((name: string, brand?: string | null) => FoodMatch | null) | null = null;

async function getMatcher() {
  if (!matcher) {
    const { default: data } = await import('./tbca.json');
    const foods = (data as { foods: TbcaFood[] }).foods;
    // Sem aliases/variedade específicos por agora — a TBCA usa nomenclatura própria
    // e pode ser afinada depois; a engine partilhada já é tolerante a acentos/ordem.
    matcher = createFoodMatcher(foods, {});
  }
  return matcher;
}

/**
 * Procura o melhor alimento da TBCA para um nome de ingrediente.
 * Retorna null quando não há casamento razoável (o chamador cai para TACO/OFF/IA).
 */
export async function findTbcaMatch(
  name: string,
  brand?: string | null,
): Promise<TbcaMatch | null> {
  const find = await getMatcher();
  return find(name, brand);
}
