#!/usr/bin/env node
/**
 * Faz scraping direto do site da TBCA (USP/FoRC) — http://www.tbca.net.br —
 * sem depender do CSV do Kaggle.
 *
 * Pra cada ingrediente do seed cujo nome bate (Jaro-Winkler >= 0.92, com gap
 * de 0.02 sobre o segundo melhor), baixa a página de composição e preenche
 * `tbca_code` + `nutrition_per_100` (se ausente) + `extras_per_100`.
 *
 *   npm run scrape:tbca           (escreve no seed)
 *   npm run scrape:tbca -- --dry  (preview)
 *   npm run scrape:tbca -- --code-only  (só preenche tbca_code; preserva nutri)
 *
 * Demora ~1-2 minutos (5800+ páginas pra listagem + ~30-50 detalhes).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const seedPath = resolve(root, 'seed/ingredients.json');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry') || args.has('--dry-run');
const codeOnly = args.has('--code-only');

const BASE = 'https://www.tbca.net.br/base-dados';
const UA =
  'Mozilla/5.0 (compatible; app-alimentacao/0.2; +https://github.com/kielima/app-alimentacao)';

function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(cru|crua|cozido|cozida|fresco|fresca|comum|in natura|natural|brasil|polpa)\b/g, '')
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

const HTML_ENTITIES = {
  '&oacute;': 'ó', '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&uacute;': 'ú',
  '&ccedil;': 'ç', '&atilde;': 'ã', '&otilde;': 'õ', '&ntilde;': 'ñ', '&iuml;': 'ï',
  '&Oacute;': 'Ó', '&Aacute;': 'Á', '&Eacute;': 'É', '&Iacute;': 'Í', '&Uacute;': 'Ú',
  '&Ccedil;': 'Ç', '&Atilde;': 'Ã', '&Otilde;': 'Õ',
  '&acirc;': 'â', '&ecirc;': 'ê', '&ocirc;': 'ô', '&icirc;': 'î', '&ucirc;': 'û',
  '&Acirc;': 'Â', '&Ecirc;': 'Ê', '&Ocirc;': 'Ô',
  '&agrave;': 'à', '&egrave;': 'è', '&ograve;': 'ò',
  '&amp;': '&', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ', '&deg;': '°',
};
function decodeEntities(s) {
  return s.replace(/&[a-zA-Z]+;/g, (e) => HTML_ENTITIES[e] || e);
}
function cleanText(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, '')).trim();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

function parseListPage(html) {
  const rowRe =
    /<tr><td><a href='int_composicao_alimentos\.php\?([^']+)'>(BRC[0-9A-Z]+)<\/a><\/td><td><a[^>]*>(.*?)<\/a><\/td><td><a[^>]*>(.*?)<\/a><\/td><td><a[^>]*>(.*?)<\/a><\/td><td><a[^>]*>(.*?)<\/a><\/td>/g;
  const rows = [];
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    rows.push({
      q: m[1],
      code: m[2],
      name: cleanText(m[3]),
      sci: cleanText(m[4]),
      group: cleanText(m[5]),
    });
  }
  return rows;
}

function parseNum(s) {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  if (!t || t === '-' || t === 'NA' || t === 'tr' || t === 'TR' || t === 'ND') return null;
  const n = Number(t.replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDetail(html) {
  const tbodyMatch = html.match(/<table id='tabela1'[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return null;
  const rowRe = /<tr>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]*)<\/td>/g;
  const data = {};
  let m;
  while ((m = rowRe.exec(tbodyMatch[1])) !== null) {
    const comp = m[1].trim();
    const unit = m[2].trim();
    const val = m[3].trim();
    data[comp] = { unit, val: parseNum(val), raw: val };
  }
  if (!Object.keys(data).length) return null;

  const energyKcal = data['Energia']?.unit === 'kcal' ? data['Energia'].val : null;
  let calories = energyKcal;
  if (calories === null) {
    const ent = Object.entries(data).find(([k, v]) => k === 'Energia' && v.unit === 'kcal');
    if (ent) calories = ent[1].val;
  }
  if (calories === null) {
    // Procura linha "Energia" com unidade kcal
    const rowReKcal = /<tr>\s*<td>Energia<\/td>\s*<td>kcal<\/td>\s*<td>([^<]*)<\/td>/;
    const k = tbodyMatch[1].match(rowReKcal);
    if (k) calories = parseNum(k[1]);
  }

  const nutrition = {
    calories: calories ?? null,
    protein: data['Proteína']?.val ?? null,
    carbs: data['Carboidrato total']?.val ?? data['Carboidrato disponível']?.val ?? null,
    sugars: data['Açúcar de adição']?.val ?? null,
    fat: data['Lipídios']?.val ?? null,
    saturated_fat: data['Ácidos graxos saturados']?.val ?? null,
    fiber: data['Fibra alimentar']?.val ?? null,
    sodium: data['Sódio']?.val ?? null,
  };
  const extras = {};
  if (data['Cálcio']?.val !== null && data['Cálcio']?.val !== undefined)
    extras.calcium_mg = data['Cálcio'].val;
  if (data['Ferro']?.val !== null && data['Ferro']?.val !== undefined)
    extras.iron_mg = data['Ferro'].val;
  if (data['Magnésio']?.val !== null && data['Magnésio']?.val !== undefined)
    extras.magnesium_mg = data['Magnésio'].val;
  if (data['Fósforo']?.val !== null && data['Fósforo']?.val !== undefined)
    extras.phosphorus_mg = data['Fósforo'].val;
  if (data['Potássio']?.val !== null && data['Potássio']?.val !== undefined)
    extras.potassium_mg = data['Potássio'].val;
  if (data['Zinco']?.val !== null && data['Zinco']?.val !== undefined)
    extras.zinc_mg = data['Zinco'].val;
  if (data['Colesterol']?.val !== null && data['Colesterol']?.val !== undefined)
    extras.cholesterol_mg = data['Colesterol'].val;
  if (data['Ácidos graxos trans']?.val !== null && data['Ácidos graxos trans']?.val !== undefined)
    extras.trans_fat_g = data['Ácidos graxos trans'].val;
  return { nutrition, extras };
}

async function fetchAllList() {
  const all = [];
  let page = 1;
  while (true) {
    const html = await fetchText(`${BASE}/composicao_alimentos.php?pagina=${page}`);
    const rows = parseListPage(html);
    if (!rows.length) break;
    all.push(...rows);
    process.stdout.write(`  página ${page}: ${rows.length} (acum: ${all.length})\r`);
    if (rows.length < 100) break;
    page++;
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`\n  total: ${all.length} alimentos`);
  return all;
}

const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
const allIng = seed.ingredients;

const targets = allIng.filter((i) => !i.tbca_code && !i.brand);
console.log(`Ingredientes alvo (sem tbca_code, sem marca): ${targets.length}`);

console.log('\nBaixando listagem da TBCA…');
const tbcaList = await fetchAllList();
const tbcaIndex = tbcaList.map((f) => ({ ...f, norm: normalize(f.name) }));

const AUTO = 0.92;
const STOPWORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'com', 'sem', 'e', 'a', 'o', 'em', 'para',
  'cru', 'crua', 'cozido', 'cozida', 'fresco', 'fresca', 'comum', 'natural',
  'brasil', 'polpa', 'integral', 'fatia', 'tipo',
]);
function significantTokens(name) {
  return new Set(
    normalize(name)
      .split(' ')
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
  );
}

const matched = [];
const blocked = [];
for (const ing of targets) {
  const targetNorm = normalize(ing.name);
  const targetTokens = significantTokens(ing.name);
  let best = null;
  let bestScore = 0;
  let runnerUp = 0;
  for (const f of tbcaIndex) {
    const s = jaroWinkler(targetNorm, f.norm);
    if (s > bestScore) {
      runnerUp = bestScore;
      bestScore = s;
      best = f;
    } else if (s > runnerUp) {
      runnerUp = s;
    }
  }
  if (best && bestScore >= AUTO && bestScore - runnerUp >= 0.02) {
    const candTokens = significantTokens(best.name);
    const missing = [...targetTokens].filter((t) => !candTokens.has(t));
    if (missing.length === 0) {
      matched.push({ ing, best, score: bestScore });
    } else {
      blocked.push({ ing, best, score: bestScore, missing });
    }
  }
}
console.log(`\nMatches auto (score >= ${AUTO} + gap 0.02 + tokens batem): ${matched.length}`);
if (blocked.length) {
  console.log(`\nDescartados por token mismatch (${blocked.length}):`);
  for (const b of blocked) {
    console.log(`  · ${b.ing.id} → ${b.best.name} (faltam: ${b.missing.join(', ')})`);
  }
}

let updated = 0;
let errors = 0;
for (const { ing, best, score } of matched) {
  try {
    const html = await fetchText(`${BASE}/int_composicao_alimentos.php?${best.q}`);
    const parsed = parseDetail(html);
    if (!parsed) {
      console.log(`  ✗ ${ing.id} — não consegui parsear ${best.code}`);
      errors++;
      continue;
    }
    if (!dryRun) {
      ing.tbca_code = best.code;
      const hasAnyMacro = Object.values(parsed.nutrition).some((v) => v !== null);
      if (!codeOnly && hasAnyMacro && (ing.nutrition_per_100 === null || ing.needs_review === true)) {
        ing.nutrition_per_100 = parsed.nutrition;
        ing.needs_review = true;
      }
      if (Object.keys(parsed.extras).length) {
        ing.extras_per_100 = { ...(ing.extras_per_100 || {}), ...parsed.extras };
      }
    }
    updated++;
    console.log(`  ✓ ${ing.id}  →  ${best.code}  ${best.name}  (${score.toFixed(3)})`);
    await new Promise((r) => setTimeout(r, 200));
  } catch (err) {
    errors++;
    console.error(`  ✗ ${ing.id} — ${err.message}`);
  }
}

console.log(`\nAtualizados: ${updated}  Erros: ${errors}`);
if (dryRun) {
  console.log('(dry-run — seed/ingredients.json não foi modificado)');
} else if (updated > 0) {
  writeFileSync(seedPath, JSON.stringify(seed, null, 2) + '\n', 'utf8');
  console.log('seed/ingredients.json atualizado.');
}
