import type { ExtractedNutrition } from './gemini';
import type { Ingredient, NutritionPer100 } from '../types/ingredient';
import type { FoodEntry, FoodMatch } from '../data/foodMatch';
import { findTacoMatch } from '../data/taco';
import { findTbcaMatch } from '../data/tbca';
import { lookupBarcode, searchByName, type OffProduct } from './openFoodFacts';

/** Resultado do preenchimento automático (cascata TBCA → TACO → Open Food Facts). */
export interface AutoFillResult {
  source: 'taco' | 'tbca' | 'off';
  data: ExtractedNutrition;
  /** Nome do alimento/produto casado, para o usuário conferir na revisão. */
  matchName: string;
  tacoId?: string;
  tbcaCode?: string;
  offBarcode?: string;
}

/** Unidade base do ingrediente (trata 'unit' como gramas). */
function baseUnit(ingredient: Ingredient): 'g' | 'ml' {
  return ingredient.default_unit === 'ml' ? 'ml' : 'g';
}

/** Envelopa uma NutritionPer100 (por 100 g/ml) no formato de revisão. */
function toExtracted(
  nutrition: NutritionPer100,
  extras: Record<string, number>,
  unit: 'g' | 'ml',
  opts: { servingDescription?: string | null; notes?: string | null } = {},
): ExtractedNutrition {
  return {
    found: true,
    unit,
    basis: unit === 'ml' ? 'per_100ml' : 'per_100g',
    normalizedFromServing: false,
    servingSizeG: null,
    servingDescription: opts.servingDescription ?? null,
    nutrition,
    extras,
    notes: opts.notes ?? null,
  };
}

function fromFood(food: FoodEntry): ExtractedNutrition {
  // Valores das tabelas (TACO/TBCA) são sempre por 100 g da parte comestível.
  return toExtracted(food.nutrition_per_100, food.extras_per_100 ?? {}, 'g');
}

function fromOff(product: OffProduct, unit: 'g' | 'ml'): ExtractedNutrition {
  return toExtracted(product.nutrition as NutritionPer100, product.extras, unit, {
    servingDescription: product.servingSize ?? null,
  });
}

/** Empacota um casamento de tabela local (TBCA/TACO) como resultado do autofill. */
function fromLocalMatch(source: 'tbca' | 'taco', match: FoodMatch): AutoFillResult {
  return {
    source,
    data: fromFood(match.food),
    matchName: match.food.name,
    ...(source === 'tbca' ? { tbcaCode: match.food.id } : { tacoId: match.food.id }),
  };
}

/**
 * Tenta preencher a tabela nutricional automaticamente:
 *   1. Bases locais TBCA e TACO — prefere-se a TBCA (mais abrangente, ~5.500
 *      alimentos), mas um casamento de ALTA confiança sobrepõe-se a um de baixa,
 *      para um palpite fraco da TBCA não vencer um acerto forte da TACO (ex.:
 *      "arroz" → não deve casar "Arroz, farelo, cru");
 *   2. Open Food Facts (código de barras salvo, senão busca por nome).
 * Devolve o resultado (para revisão) ou null quando nada serve — nesse caso o
 * chamador oferece o preenchimento manual (foto ou IA).
 */
export async function autoFillNutrition(ingredient: Ingredient): Promise<AutoFillResult | null> {
  // 1) Bases locais. TBCA primeiro entre casamentos de igual confiança; um
  // casamento 'high' (de qualquer base) vence um 'medium'.
  const tbca = await findTbcaMatch(ingredient.name, ingredient.brand);
  const taco = findTacoMatch(ingredient.name, ingredient.brand);
  const localMatch =
    (tbca?.confidence === 'high' && (['tbca', tbca] as const)) ||
    (taco?.confidence === 'high' && (['taco', taco] as const)) ||
    (tbca && (['tbca', tbca] as const)) ||
    (taco && (['taco', taco] as const)) ||
    null;
  if (localMatch) return fromLocalMatch(localMatch[0], localMatch[1]);

  // 2) Open Food Facts. Erros de rede caem no fluxo manual (retorna null).
  const unit = baseUnit(ingredient);
  try {
    // Se já houver código de barras, tenta ele primeiro (dados exatos do rótulo).
    if (ingredient.off_barcode) {
      const res = await lookupBarcode(ingredient.off_barcode);
      if (res.found && res.product?.nutrition) {
        return {
          source: 'off',
          data: fromOff(res.product, unit),
          matchName: res.product.name || ingredient.name,
          offBarcode: res.product.barcode,
        };
      }
    }
    const product = await searchByName(ingredient.name);
    if (product?.nutrition) {
      return {
        source: 'off',
        data: fromOff(product, unit),
        matchName: product.name || ingredient.name,
        offBarcode: product.barcode,
      };
    }
  } catch {
    // rede indisponível / OFF fora do ar → deixa o usuário preencher manualmente
  }

  return null;
}
