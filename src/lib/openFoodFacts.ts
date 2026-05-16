import type { NutritionPer100 } from '../types/ingredient';

const USER_AGENT = 'app-alimentacao/0.2 (https://github.com/kielima/app-alimentacao)';
const CACHE_KEY = 'app-alimentacao:off-cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface OffProduct {
  barcode: string;
  name: string;
  brands?: string;
  imageUrl?: string;
  imageSmallUrl?: string;
  servingSize?: string;
  ingredientsText?: string;
  allergens?: string;
  nutrition: NutritionPer100 | null;
  extras: Record<string, number>;
}

export interface OffLookupResult {
  found: boolean;
  product?: OffProduct;
  rawProductName?: string;
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function readCache(): Record<string, { ts: number; result: OffLookupResult }> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, { ts: number; result: OffLookupResult }>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable — não crítico
  }
}

function getCached(barcode: string): OffLookupResult | null {
  const cache = readCache();
  const entry = cache[barcode];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.result;
}

function setCached(barcode: string, result: OffLookupResult) {
  const cache = readCache();
  cache[barcode] = { ts: Date.now(), result };
  writeCache(cache);
}

function mapProduct(barcode: string, raw: Record<string, unknown>): OffProduct {
  const n = (raw.nutriments ?? {}) as Record<string, unknown>;
  const energyKcal = num(n['energy-kcal_100g']);
  const energyKJ = num(n['energy_100g']);
  const calories = energyKcal ?? (energyKJ !== null ? Math.round(energyKJ / 4.184) : null);

  const sodium100g = num(n.sodium_100g);
  const sodium_mg = sodium100g !== null ? Math.round(sodium100g * 1000) : null;

  const hasAnyMacro = [
    calories,
    num(n.proteins_100g),
    num(n.carbohydrates_100g),
    num(n.fat_100g),
  ].some((v) => v !== null);

  const nutrition: NutritionPer100 | null = hasAnyMacro
    ? {
        calories: calories ?? 0,
        protein: num(n.proteins_100g) ?? 0,
        carbs: num(n.carbohydrates_100g) ?? 0,
        sugars: num(n.sugars_100g),
        fat: num(n.fat_100g) ?? 0,
        saturated_fat: num(n['saturated-fat_100g']),
        fiber: num(n.fiber_100g),
        sodium: sodium_mg,
      }
    : null;

  const extras: Record<string, number> = {};
  const calcium = num(n.calcium_100g);
  if (calcium !== null) extras.calcium_mg = Math.round(calcium * 1000);
  const iron = num(n.iron_100g);
  if (iron !== null) extras.iron_mg = Math.round(iron * 100) / 100;
  const potassium = num(n.potassium_100g);
  if (potassium !== null) extras.potassium_mg = Math.round(potassium * 1000);
  const transFat = num(n['trans-fat_100g']);
  if (transFat !== null) extras.trans_fat_g = transFat;
  const cholesterol = num(n.cholesterol_100g);
  if (cholesterol !== null) extras.cholesterol_mg = Math.round(cholesterol * 1000);

  const productName =
    (raw.product_name_pt as string) ||
    (raw.product_name as string) ||
    (raw.generic_name_pt as string) ||
    (raw.generic_name as string) ||
    '';

  return {
    barcode,
    name: productName,
    brands: (raw.brands as string) || undefined,
    imageUrl: (raw.image_url as string) || (raw.image_front_url as string) || undefined,
    imageSmallUrl:
      (raw.image_small_url as string) || (raw.image_front_small_url as string) || undefined,
    servingSize: (raw.serving_size as string) || undefined,
    ingredientsText:
      (raw.ingredients_text_pt as string) || (raw.ingredients_text as string) || undefined,
    allergens: (raw.allergens as string) || undefined,
    nutrition,
    extras,
  };
}

export async function lookupBarcode(
  barcode: string,
  options: { skipCache?: boolean; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<OffLookupResult> {
  if (!options.skipCache) {
    const cached = getCached(barcode);
    if (cached) return cached;
  }

  const timeout = options.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) throw new Error('Tempo esgotado consultando Open Food Facts.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Open Food Facts: HTTP ${res.status}`);
  const json = (await res.json()) as { status?: number; product?: Record<string, unknown> };

  let result: OffLookupResult;
  if (json.status !== 1 || !json.product) {
    result = { found: false };
  } else {
    const product = mapProduct(barcode, json.product);
    result = {
      found: true,
      product,
      rawProductName: (json.product.product_name as string) || undefined,
    };
  }
  setCached(barcode, result);
  return result;
}

export function isValidEan(code: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  for (let i = digits.length - 1, mul = 3; i >= 0; i--, mul = mul === 3 ? 1 : 3) {
    sum += digits[i] * mul;
  }
  const computed = (10 - (sum % 10)) % 10;
  return computed === check;
}
