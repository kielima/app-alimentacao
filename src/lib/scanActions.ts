import type { NavigateFunction } from 'react-router-dom';
import type { ScanAction } from '../components/ScannedProductCard';
import type { BarcodeScanResult } from '../components/BarcodeScannerModal';
import type { Ingredient, NutritionPer100 } from '../types/ingredient';
import { upsertUserIngredient } from '../data/userIngredients';
import { upsertShoppingItem } from '../data/shoppingList';
import { upsertPantryItem } from '../data/pantry';
import { uniqueSlug } from '../utils/slug';
import { allIngredientIds } from '../data/ingredients';

export function findIngredientByBarcode(
  barcode: string,
  ingredients: Ingredient[],
): Ingredient | undefined {
  return ingredients.find((i) => i.off_barcode === barcode);
}

function defaultDisplayName(result: BarcodeScanResult): string {
  const product = result.lookup.product;
  if (product?.name) return product.name;
  return `Produto ${result.barcode}`;
}

function defaultRawText(result: BarcodeScanResult, existing?: Ingredient): string {
  if (existing) {
    return existing.brand ? `${existing.brand} — ${existing.name}` : existing.name;
  }
  const product = result.lookup.product;
  if (product?.name && product?.brands) return `${product.brands} — ${product.name}`;
  return defaultDisplayName(result);
}

function ensureIngredientFromScan(
  result: BarcodeScanResult,
  existing: Ingredient[],
): Ingredient {
  const match = findIngredientByBarcode(result.barcode, existing);
  if (match) return match;
  const product = result.lookup.product;
  const name = product?.name?.trim() || `Produto ${result.barcode}`;
  const id = uniqueSlug(name, allIngredientIds());
  const ing: Ingredient = {
    id,
    name,
    brand: product?.brands?.split(',')[0]?.trim() || null,
    default_unit: 'g',
    nutrition_per_100: (product?.nutrition as NutritionPer100 | null) ?? null,
    off_barcode: result.barcode,
    ingredients_text: product?.ingredientsText,
    allergens: product?.allergens,
    needs_review: true,
  };
  if (product?.extras && Object.keys(product.extras).length) {
    ing.extras_per_100 = product.extras;
  }
  upsertUserIngredient(ing);
  return ing;
}

export function handleScanForShoppingList(
  result: BarcodeScanResult,
  action: ScanAction,
  ingredients: Ingredient[],
  navigate: NavigateFunction,
) {
  if (action === 'manual-not-found') {
    navigate(
      `/ingredientes/novo?return=%2Fcompras&barcode=${encodeURIComponent(result.barcode)}`,
    );
    return;
  }
  if (action !== 'add-shopping') return;
  const ing = ensureIngredientFromScan(result, ingredients);
  upsertShoppingItem({
    id: `scan-${Date.now()}-${ing.id}`,
    ingredient_id: ing.id,
    raw_text: defaultRawText(result, ing),
    quantity: null,
    unit: ing.default_unit ?? null,
    store: null,
    price: null,
    checked: false,
    source: 'manual',
    source_ref: ing.id,
    added_at: new Date().toISOString(),
  });
}

export function handleScanForPantry(
  result: BarcodeScanResult,
  action: ScanAction,
  ingredients: Ingredient[],
  navigate: NavigateFunction,
) {
  if (action === 'manual-not-found') {
    navigate(
      `/ingredientes/novo?return=%2Fdispensa&barcode=${encodeURIComponent(result.barcode)}`,
    );
    return;
  }
  if (action !== 'add-pantry') return;
  const ing = ensureIngredientFromScan(result, ingredients);
  upsertPantryItem({
    id: `scan-${Date.now()}-${ing.id}`,
    ingredient_id: ing.id,
    raw_text: defaultRawText(result, ing),
    quantity: null,
    unit: ing.default_unit ?? null,
    expiry_date: null,
    store: null,
    added_at: new Date().toISOString(),
  });
}

export function handleScanForIngredientsList(
  result: BarcodeScanResult,
  action: ScanAction,
  ingredients: Ingredient[],
  navigate: NavigateFunction,
) {
  if (action === 'manual-not-found') {
    navigate(
      `/ingredientes/novo?barcode=${encodeURIComponent(result.barcode)}`,
    );
    return;
  }
  if (action !== 'create-ingredient') return;
  const ing = ensureIngredientFromScan(result, ingredients);
  navigate(`/ingredientes/${ing.id}`);
}

