import { useState } from 'react';
import Icon from './Icon';
import type { ExtractedNutrition } from '../lib/gemini';
import { upsertUserIngredient } from '../data/userIngredients';
import type { Ingredient, NutritionPer100 } from '../types/ingredient';

/** De onde vieram os valores que estão em revisão. */
export type NutritionSource = 'photo' | 'taco' | 'off' | 'ai';

interface Props {
  ingredient: Ingredient;
  /** Valores iniciais, já normalizados por 100 g/ml. */
  data: ExtractedNutrition;
  source: NutritionSource;
  /** Nome do alimento/produto casado (TACO/OFF), para conferência. */
  matchName?: string;
  tacoId?: string;
  offBarcode?: string;
  /** Botão secundário (ex.: "Outra foto"). Escondido se ausente. */
  backLabel?: string;
  onBack?: () => void;
  onSaved?: () => void;
  onClose: () => void;
}

// Campos macro, na ordem de exibição. Espelha a tabela do detalhe.
const MACRO_FIELDS: { key: keyof NutritionPer100; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calorias', unit: 'kcal' },
  { key: 'protein', label: 'Proteínas', unit: 'g' },
  { key: 'carbs', label: 'Carboidratos', unit: 'g' },
  { key: 'sugars', label: '— açúcares', unit: 'g' },
  { key: 'fat', label: 'Gorduras totais', unit: 'g' },
  { key: 'saturated_fat', label: '— saturadas', unit: 'g' },
  { key: 'fiber', label: 'Fibras', unit: 'g' },
  { key: 'sodium', label: 'Sódio', unit: 'mg' },
];

const EXTRA_LABELS: Record<string, { label: string; unit: string }> = {
  trans_fat_g: { label: 'Gorduras trans', unit: 'g' },
  cholesterol_mg: { label: 'Colesterol', unit: 'mg' },
  calcium_mg: { label: 'Cálcio', unit: 'mg' },
  iron_mg: { label: 'Ferro', unit: 'mg' },
  potassium_mg: { label: 'Potássio', unit: 'mg' },
};

/** Converte o número (ou null) para string editável. */
function toStr(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Converte a string de volta para número ou null (vazio = null). */
function toNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Texto do selo/aviso conforme a origem dos valores. */
function sourceBanner(
  source: NutritionSource,
  unitSuffix: string,
  matchName: string | undefined,
): { icon: string; tone: 'ok' | 'warn'; title: string; body: string } {
  switch (source) {
    case 'taco':
      return {
        icon: 'utensils',
        tone: 'ok',
        title: 'Tabela TACO (NEPA/UNICAMP)',
        body: matchName
          ? `Valores de "${matchName}" (TACO), por 100 ${unitSuffix}. Se não for o mesmo alimento, feche e use foto ou IA.`
          : `Valores por 100 ${unitSuffix} — confira e ajuste se precisar.`,
      };
    case 'off':
      return {
        icon: 'tag',
        tone: 'ok',
        title: 'Open Food Facts',
        body: matchName
          ? `Produto "${matchName}". Valores por 100 ${unitSuffix} — confira antes de salvar.`
          : `Valores por 100 ${unitSuffix} — confira antes de salvar.`,
      };
    case 'ai':
      return {
        icon: 'sparkles',
        tone: 'warn',
        title: 'Estimativa por IA — confira com atenção',
        body: `Valores aproximados gerados por IA, por 100 ${unitSuffix}. Corrija o que estiver errado.`,
      };
    default:
      return {
        icon: 'check-circle',
        tone: 'ok',
        title: 'Confira os valores antes de salvar',
        body: `Valores por 100 ${unitSuffix}. Corrija o que estiver errado — a leitura automática pode falhar.`,
      };
  }
}

/**
 * Bloco de revisão + salvar de uma tabela nutricional. Renderiza dentro do
 * corpo (escuro) de um modal em tela cheia. Compartilhado pela leitura por foto
 * e pelo preenchimento automático (TACO/OFF/IA).
 */
export default function NutritionReview({
  ingredient,
  data,
  source,
  matchName,
  tacoId,
  offBarcode,
  backLabel,
  onBack,
  onSaved,
  onClose,
}: Props) {
  const [unit, setUnit] = useState<'g' | 'ml'>(data.unit);
  const [macros, setMacros] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const { key } of MACRO_FIELDS) m[key] = toStr(data.nutrition[key]);
    return m;
  });
  const [extras, setExtras] = useState<Record<string, string>>(() => {
    const ex: Record<string, string> = {};
    for (const key of Object.keys(EXTRA_LABELS)) ex[key] = toStr(data.extras[key]);
    return ex;
  });
  const [servingSize, setServingSize] = useState(toStr(data.servingSizeG));
  const [servingDesc, setServingDesc] = useState(data.servingDescription ?? '');

  const unitSuffix = unit === 'ml' ? 'ml' : 'g';
  const banner = sourceBanner(source, unitSuffix, matchName);

  const handleSave = () => {
    const nutrition: NutritionPer100 = {
      calories: toNum(macros.calories) ?? 0,
      protein: toNum(macros.protein) ?? 0,
      carbs: toNum(macros.carbs) ?? 0,
      sugars: toNum(macros.sugars),
      fat: toNum(macros.fat) ?? 0,
      saturated_fat: toNum(macros.saturated_fat),
      fiber: toNum(macros.fiber),
      sodium: toNum(macros.sodium),
    };

    const extrasOut: Record<string, number> = { ...(ingredient.extras_per_100 ?? {}) } as Record<
      string,
      number
    >;
    for (const key of Object.keys(EXTRA_LABELS)) {
      const v = toNum(extras[key]);
      if (v === null) delete extrasOut[key];
      else extrasOut[key] = v;
    }

    const servingNum = toNum(servingSize);
    const payload: Ingredient = {
      ...ingredient,
      default_unit: ingredient.default_unit === 'unit' ? 'unit' : unit,
      nutrition_per_100: nutrition,
      extras_per_100: Object.keys(extrasOut).length ? extrasOut : undefined,
      needs_review: false,
    };
    if (source === 'taco' && tacoId) payload.taco_id = tacoId;
    if (source === 'off' && offBarcode) payload.off_barcode = offBarcode;
    if (servingNum !== null) payload.serving_size_g = servingNum;
    if (servingDesc.trim()) payload.serving_description = servingDesc.trim();

    upsertUserIngredient(payload);
    onSaved?.();
    onClose();
  };

  return (
    <div className="text-zinc-100">
      <div className="mb-4 rounded-xl bg-zinc-900 p-3 text-xs text-zinc-300">
        <p className="mb-1 flex items-center gap-1.5 font-medium text-zinc-100">
          <Icon
            name={banner.icon}
            className={`h-4 w-4 ${banner.tone === 'warn' ? 'text-amber-400' : 'text-emerald-400'}`}
          />
          {banner.title}
        </p>
        <p className="text-zinc-400">{banner.body}</p>
        {data.normalizedFromServing && (
          <p className="mt-1.5 text-amber-300">
            O rótulo só tinha valores por porção; converti para 100 {unitSuffix} usando a porção de{' '}
            {data.servingSizeG} {unitSuffix}. Revise com atenção.
          </p>
        )}
        {data.notes && <p className="mt-1.5 text-zinc-400">Obs. da IA: {data.notes}</p>}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Base</span>
        <div className="flex overflow-hidden rounded-lg border border-zinc-700">
          {(['g', 'ml'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`px-3 py-1 text-sm ${
                unit === u
                  ? 'bg-brand-500 text-white'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              100 {u}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Macronutrientes
        </p>
        <div className="space-y-2">
          {MACRO_FIELDS.map(({ key, label, unit: u }) => (
            <FieldRow
              key={key}
              label={label}
              unit={u}
              value={macros[key] ?? ''}
              onChange={(v) => setMacros((p) => ({ ...p, [key]: v }))}
            />
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Micronutrientes (opcional)
        </p>
        <div className="space-y-2">
          {Object.entries(EXTRA_LABELS).map(([key, { label, unit: u }]) => (
            <FieldRow
              key={key}
              label={label}
              unit={u}
              value={extras[key] ?? ''}
              onChange={(v) => setExtras((p) => ({ ...p, [key]: v }))}
            />
          ))}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Porção (opcional)
        </p>
        <div className="space-y-2">
          <FieldRow
            label="Tamanho"
            unit={unitSuffix}
            value={servingSize}
            onChange={setServingSize}
          />
          <label className="flex items-center gap-2">
            <span className="w-40 shrink-0 text-sm text-zinc-300">Descrição</span>
            <input
              type="text"
              value={servingDesc}
              onChange={(e) => setServingDesc(e.target.value)}
              placeholder='Ex.: "2 fatias"'
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
            />
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        {backLabel && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700"
          >
            {backLabel}
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          Salvar valores
        </button>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isSubrow = label.startsWith('—');
  return (
    <label className="flex items-center gap-2">
      <span
        className={`w-40 shrink-0 text-sm ${isSubrow ? 'pl-3 text-zinc-400' : 'text-zinc-300'}`}
      >
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-right text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
      />
      <span className="w-10 shrink-0 text-xs text-zinc-400">{unit}</span>
    </label>
  );
}
