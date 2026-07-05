// Gera src/data/tbca.json a partir de um dump da TBCA em JSON-lines.
//
// Fonte dos dados: Tabela Brasileira de Composição de Alimentos (TBCA),
// USP/FoRC — https://www.tbca.net.br (valores por 100 g de parte comestível).
// A TBCA não oferece download/API oficial; o input é um dump por scraping das
// páginas de composição (um objeto JSON por linha).
//
// Input (não versionado — ver scripts/data/.gitignore): scripts/data/tbca-raw.jsonl
//   Cada linha: { codigo, classe, descricao, nutrientes: [
//     { "Componente": "Energia", "Unidades": "kcal", "Valor por 100g": "121" }, ... ] }
//
// Uso: node scripts/build-tbca.mjs [input.jsonl]
// Saída: src/data/tbca.json, com a MESMA forma de src/data/taco.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = process.argv[2] ?? resolve(__dirname, 'data/tbca-raw.jsonl');
const OUTPUT = resolve(__dirname, '../src/data/tbca.json');

const SOURCE =
  'Tabela Brasileira de Composição de Alimentos (TBCA), USP/FoRC — tbca.net.br. ' +
  'Valores por 100 g da parte comestível.';
const NOTE =
  'Açúcares totais não constam na TBCA (o campo sugars fica nulo). ' +
  '"tr" (traço) é normalizado para 0; "NA" (não analisado) fica nulo.';

/** Converte um valor PT-BR ("66,2", "tr", "NA", "") para número ou null. */
function num(raw) {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (t === '' || t === 'NA' || t === '-' || t === '*') return null;
  if (t === 'tr') return 0; // traço → quantidade desprezível
  // Na TBCA só a vírgula é separador decimal (não há separador de milhar).
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Índice Componente(+Unidade) → valor numérico, para um alimento. */
function indexNutrients(nutrientes) {
  const byKey = new Map();
  for (const n of nutrientes ?? []) {
    const comp = n.Componente;
    const value = num(n['Valor por 100g']);
    byKey.set(comp, value); // sem unidade
    byKey.set(`${comp}|${n.Unidades}`, value); // com unidade (desambigua Energia kJ/kcal)
  }
  return byKey;
}

/** Nome legível: tira vírgulas/espaços finais e colapsa espaços. */
function cleanName(descricao) {
  return String(descricao ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[\s,]+$/, '')
    .trim();
}

const lines = readFileSync(INPUT, 'utf8').split('\n');
const foods = [];
let skipped = 0;

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  let record;
  try {
    record = JSON.parse(trimmed);
  } catch {
    skipped++;
    continue;
  }

  const id = String(record.codigo ?? '').trim();
  const name = cleanName(record.descricao);
  if (!id || !name) {
    skipped++;
    continue;
  }

  const c = indexNutrients(record.nutrientes);
  const calories = c.get('Energia|kcal');
  if (calories == null) {
    skipped++; // sem energia declarada → inútil para a tabela nutricional
    continue;
  }

  const nutrition_per_100 = {
    calories,
    protein: c.get('Proteína') ?? 0,
    // "disponível" (exclui fibra) casa com a convenção da TACO, que mostra fibra à parte.
    carbs: c.get('Carboidrato disponível') ?? c.get('Carboidrato total') ?? 0,
    sugars: null, // não disponível na TBCA
    fat: c.get('Lipídios') ?? 0,
    saturated_fat: c.get('Ácidos graxos saturados'),
    fiber: c.get('Fibra alimentar'),
    sodium: c.get('Sódio'),
  };

  // Extras conhecidos pelo app (ver EXTRA_LABELS em NutritionReview.tsx).
  const extrasSrc = {
    trans_fat_g: c.get('Ácidos graxos trans'),
    cholesterol_mg: c.get('Colesterol'),
    calcium_mg: c.get('Cálcio'),
    iron_mg: c.get('Ferro'),
    potassium_mg: c.get('Potássio'),
  };
  const extras_per_100 = {};
  for (const [k, v] of Object.entries(extrasSrc)) {
    if (v != null) extras_per_100[k] = v;
  }

  const food = { id, name, category: record.classe ?? null, nutrition_per_100 };
  if (Object.keys(extras_per_100).length) food.extras_per_100 = extras_per_100;
  foods.push(food);
}

writeFileSync(OUTPUT, JSON.stringify({ $source: SOURCE, $note: NOTE, foods }));
console.log(`TBCA: ${foods.length} alimentos gravados em ${OUTPUT} (${skipped} ignorados).`);
