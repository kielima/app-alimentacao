#!/usr/bin/env node
/**
 * Preenche/atualiza tabelas nutricionais de produtos com marca a partir
 * da API pública do Open Food Facts.
 *
 * Como usar:
 *   1. Em seed/ingredients.json, preencha off_barcode no produto desejado
 *      (lendo o EAN-13 da embalagem).
 *   2. npm run import:off          (escreve no JSON)
 *      npm run import:off -- --dry (preview)
 *      npm run import:off -- --force (sobrescreve nutrition_per_100 existente)
 *
 * Por padrão, só preenche ingredientes com off_barcode E nutrition_per_100 == null.
 * Marca needs_review: true em tudo que preenche.
 *
 * A API do OFF exige User-Agent identificando o app:
 *   https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const seedPath = resolve(root, 'seed/ingredients.json');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry') || args.has('--dry-run');
const force = args.has('--force');

const USER_AGENT = 'app-alimentacao/0.2 (https://github.com/kielima/app-alimentacao)';

function num(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchProduct(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} para ${barcode}`);
  const json = await res.json();
  if (json.status !== 1) return null;
  return json.product;
}

function mapProduct(product) {
  const n = product.nutriments || {};
  return {
    nutrition_per_100: {
      calories: num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) ? Math.round(num(n['energy_100g']) / 4.184) : null),
      protein: num(n.proteins_100g),
      carbs: num(n.carbohydrates_100g),
      sugars: num(n.sugars_100g),
      fat: num(n.fat_100g),
      saturated_fat: num(n['saturated-fat_100g']),
      fiber: num(n.fiber_100g),
      sodium: num(n.sodium_100g) !== null ? Math.round(num(n.sodium_100g) * 1000) : null,
    },
    extras: Object.fromEntries(
      Object.entries({
        calcium_mg: num(n.calcium_100g) !== null ? num(n.calcium_100g) * 1000 : null,
        iron_mg: num(n.iron_100g) !== null ? num(n.iron_100g) * 1000 : null,
        potassium_mg: num(n.potassium_100g) !== null ? num(n.potassium_100g) * 1000 : null,
        trans_fat_g: num(n['trans-fat_100g']),
        cholesterol_mg: num(n.cholesterol_100g) !== null ? num(n.cholesterol_100g) * 1000 : null,
      }).filter(([, v]) => v !== null && v !== undefined),
    ),
    ingredients_text: product.ingredients_text_pt || product.ingredients_text || undefined,
    allergens: product.allergens_from_user || product.allergens || undefined,
  };
}

const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const targets = seed.ingredients.filter((i) => {
  if (!i.off_barcode) return false;
  if (force) return true;
  return i.nutrition_per_100 === null;
});

if (!targets.length) {
  console.log('Nada a fazer. Preencha off_barcode em algum ingrediente primeiro (ou use --force).');
  process.exit(0);
}

console.log(`Consultando Open Food Facts para ${targets.length} produto(s)…`);

let updated = 0;
let notFound = 0;
let errors = 0;

for (const ing of targets) {
  try {
    const product = await fetchProduct(ing.off_barcode);
    if (!product) {
      notFound++;
      console.log(`  · ${ing.name} [${ing.off_barcode}] — não encontrado`);
      continue;
    }
    const mapped = mapProduct(product);
    const hasAnyMacro = Object.values(mapped.nutrition_per_100).some((v) => v !== null);
    if (!hasAnyMacro) {
      console.log(`  · ${ing.name} [${ing.off_barcode}] — sem dados nutricionais no OFF`);
      continue;
    }
    if (!dryRun) {
      ing.nutrition_per_100 = mapped.nutrition_per_100;
      if (Object.keys(mapped.extras).length) {
        ing.extras_per_100 = { ...(ing.extras_per_100 || {}), ...mapped.extras };
      }
      if (mapped.ingredients_text && !ing.ingredients_text) ing.ingredients_text = mapped.ingredients_text;
      if (mapped.allergens && !ing.allergens) ing.allergens = mapped.allergens;
      ing.needs_review = true;
    }
    updated++;
    console.log(`  ✓ ${ing.name} [${ing.off_barcode}] — ${product.product_name || product.product_name_pt || '(sem nome)'}`);
  } catch (err) {
    errors++;
    console.error(`  ✗ ${ing.name} [${ing.off_barcode}] — ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 250));
}

console.log(`\nAtualizados: ${updated}  Não encontrados: ${notFound}  Erros: ${errors}`);

if (dryRun) {
  console.log('(dry-run — seed/ingredients.json não foi modificado)');
} else if (updated > 0) {
  writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n', 'utf8');
  console.log('seed/ingredients.json atualizado.');
}
