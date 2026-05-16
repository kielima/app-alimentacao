#!/usr/bin/env node
/**
 * Preenche tabelas nutricionais dos ingredientes a partir da TBCA
 * (Tabela Brasileira de Composição de Alimentos — USP/FoRC).
 *
 * Fonte: dataset Kaggle "Alimentos Brasileiros com Dados da TBCA"
 *        https://www.kaggle.com/datasets/proflucassoares/alimentos-brasileiros-com-dados-da-tbca
 *
 * Como usar:
 *   1. Baixe o CSV do Kaggle e salve em scripts/data/tbca.csv
 *   2. npm run import:tbca           (escreve em seed/ingredients.json)
 *      npm run import:tbca -- --dry  (preview sem escrever)
 *
 * Comportamento:
 *   - Só toca em ingredientes com nutrition_per_100 == null
 *     OU com needs_review === true (preenche/atualiza esses).
 *   - Match por nome normalizado + Jaro-Winkler. Score >= 0.92 = auto-match.
 *     0.75-0.92 = vai pra scripts/data/tbca-candidates.json pra você revisar.
 *   - Marca needs_review: true em todo ingrediente preenchido automaticamente.
 *   - Grava tbca_code com o código TBCA (ex.: "BRC0001C").
 *   - Idempotente.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const seedPath = resolve(root, 'seed/ingredients.json');
const csvPath = resolve(__dirname, 'data/tbca.csv');
const candidatesPath = resolve(__dirname, 'data/tbca-candidates.json');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry') || args.has('--dry-run');

if (!existsSync(csvPath)) {
  console.error('CSV da TBCA não encontrado em scripts/data/tbca.csv');
  console.error('Baixe em: https://www.kaggle.com/datasets/proflucassoares/alimentos-brasileiros-com-dados-da-tbca');
  process.exit(1);
}

function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(cru|crua|cozido|cozida|fresco|fresca|comum|in natura|natural)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function jaroWinkler(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const matchDist = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function parseCSV(content) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',' || c === ';') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function num(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(',', '.');
  if (!s || s === '-' || s.toLowerCase() === 'tr' || s.toLowerCase() === 'nd' || s === 'NA') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pickCol(header, candidates) {
  const lc = header.map((h) => h.toLowerCase().trim());
  for (const cand of candidates) {
    const idx = lc.indexOf(cand.toLowerCase());
    if (idx !== -1) return idx;
  }
  for (const cand of candidates) {
    const idx = lc.findIndex((h) => h.includes(cand.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

const csvRaw = readFileSync(csvPath, 'utf8');
const rows = parseCSV(csvRaw).filter((r) => r.length > 1);
if (rows.length < 2) {
  console.error('CSV vazio ou sem linhas de dados.');
  process.exit(1);
}
const header = rows[0];
const cols = {
  code: pickCol(header, ['Código', 'codigo', 'code', 'cod']),
  name: pickCol(header, ['Nome', 'name', 'descricao', 'descrição', 'alimento']),
  calories: pickCol(header, ['Energia (kcal)', 'energia kcal', 'kcal', 'calorias']),
  protein: pickCol(header, ['Proteína (g)', 'proteina', 'protein']),
  carbs: pickCol(header, ['Carboidrato total (g)', 'carboidrato', 'carbs']),
  sugars: pickCol(header, ['Açúcares totais (g)', 'acucares', 'sugars']),
  fat: pickCol(header, ['Lipídios (g)', 'lipidios', 'gordura', 'fat']),
  saturated: pickCol(header, ['Gordura saturada (g)', 'saturada', 'saturated']),
  fiber: pickCol(header, ['Fibra alimentar (g)', 'fibra', 'fiber']),
  sodium: pickCol(header, ['Sódio (mg)', 'sodio', 'sodium']),
  calcium: pickCol(header, ['Cálcio (mg)', 'calcio', 'calcium']),
  iron: pickCol(header, ['Ferro (mg)', 'ferro', 'iron']),
  magnesium: pickCol(header, ['Magnésio (mg)', 'magnesio', 'magnesium']),
  phosphorus: pickCol(header, ['Fósforo (mg)', 'fosforo', 'phosphorus']),
  potassium: pickCol(header, ['Potássio (mg)', 'potassio', 'potassium']),
  zinc: pickCol(header, ['Zinco (mg)', 'zinco', 'zinc']),
};

if (cols.name === -1) {
  console.error('Não achei coluna de nome no CSV. Cabeçalho:', header);
  process.exit(1);
}

const tbcaFoods = rows.slice(1).map((r) => ({
  code: cols.code !== -1 ? r[cols.code]?.trim() : null,
  name: r[cols.name]?.trim() || '',
  norm: normalize(r[cols.name] || ''),
  nutrition: {
    calories: num(r[cols.calories]),
    protein: num(r[cols.protein]),
    carbs: num(r[cols.carbs]),
    sugars: num(r[cols.sugars]),
    fat: num(r[cols.fat]),
    saturated_fat: num(r[cols.saturated]),
    fiber: num(r[cols.fiber]),
    sodium: num(r[cols.sodium]),
  },
  extras: {
    calcium_mg: num(r[cols.calcium]),
    iron_mg: num(r[cols.iron]),
    magnesium_mg: num(r[cols.magnesium]),
    phosphorus_mg: num(r[cols.phosphorus]),
    potassium_mg: num(r[cols.potassium]),
    zinc_mg: num(r[cols.zinc]),
  },
})).filter((f) => f.norm);

console.log(`TBCA: ${tbcaFoods.length} alimentos carregados.`);

const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const targets = seed.ingredients.filter(
  (i) => i.nutrition_per_100 === null || i.needs_review === true,
);
console.log(`Ingredientes alvo (sem nutrição ou needs_review): ${targets.length}`);

const AUTO = 0.92;
const REVIEW = 0.75;
const candidates = [];
let autoCount = 0;

for (const ing of targets) {
  if (ing.tbca_code) continue;
  const targetNorm = normalize(ing.name);
  let best = null;
  let bestScore = 0;
  let runnerUp = 0;
  for (const f of tbcaFoods) {
    const s = jaroWinkler(targetNorm, f.norm);
    if (s > bestScore) {
      runnerUp = bestScore;
      bestScore = s;
      best = f;
    } else if (s > runnerUp) {
      runnerUp = s;
    }
  }
  if (!best) continue;

  if (bestScore >= AUTO && bestScore - runnerUp >= 0.02) {
    autoCount++;
    if (!dryRun) {
      ing.nutrition_per_100 = best.nutrition;
      const extras = {};
      for (const [k, v] of Object.entries(best.extras)) {
        if (v !== null && v !== undefined) extras[k] = v;
      }
      if (Object.keys(extras).length) {
        ing.extras_per_100 = { ...(ing.extras_per_100 || {}), ...extras };
      }
      if (best.code) ing.tbca_code = best.code;
      ing.needs_review = true;
    }
    console.log(`  ✓ ${ing.name}  →  ${best.name}  [${best.code || '-'}]  (${bestScore.toFixed(3)})`);
  } else if (bestScore >= REVIEW) {
    candidates.push({
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      score: Number(bestScore.toFixed(3)),
      runner_up_score: Number(runnerUp.toFixed(3)),
      tbca_code: best.code,
      tbca_name: best.name,
    });
  }
}

console.log(`\nAuto-match: ${autoCount}`);
console.log(`Para revisão manual: ${candidates.length}`);

if (candidates.length) {
  writeFileSync(candidatesPath, JSON.stringify(candidates, null, 2), 'utf8');
  console.log(`Candidatos gravados em ${candidatesPath}`);
}

if (dryRun) {
  console.log('\n(dry-run — seed/ingredients.json não foi modificado)');
} else if (autoCount > 0) {
  writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n', 'utf8');
  console.log(`seed/ingredients.json atualizado.`);
}
