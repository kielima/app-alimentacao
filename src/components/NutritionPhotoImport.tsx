import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { extractNutritionFromImage, type ExtractedNutrition } from '../lib/gemini';
import { upsertUserIngredient } from '../data/userIngredients';
import type { Ingredient, NutritionPer100 } from '../types/ingredient';

interface Props {
  ingredient: Ingredient;
  open: boolean;
  onClose: () => void;
  /** Chamado após salvar com sucesso os valores no ingrediente. */
  onSaved?: () => void;
}

type Stage =
  | { kind: 'pick' }
  | { kind: 'loading' }
  | { kind: 'review'; data: ExtractedNutrition }
  | { kind: 'error'; message: string };

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

export default function NutritionPhotoImport({ ingredient, open, onClose, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'pick' });
  const [unit, setUnit] = useState<'g' | 'ml'>('g');
  const [macros, setMacros] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [servingSize, setServingSize] = useState('');
  const [servingDesc, setServingDesc] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setStage({ kind: 'pick' });
  }, [open]);

  if (!open) return null;

  const loadReview = (data: ExtractedNutrition) => {
    setUnit(data.unit);
    const m: Record<string, string> = {};
    for (const { key } of MACRO_FIELDS) m[key] = toStr(data.nutrition[key]);
    setMacros(m);
    const ex: Record<string, string> = {};
    for (const key of Object.keys(EXTRA_LABELS)) ex[key] = toStr(data.extras[key]);
    setExtras(ex);
    setServingSize(toStr(data.servingSizeG));
    setServingDesc(data.servingDescription ?? '');
    setStage({ kind: 'review', data });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setStage({ kind: 'loading' });
    try {
      const data = await extractNutritionFromImage(file);
      if (!data.found) {
        setStage({
          kind: 'error',
          message:
            'Não encontrei uma tabela nutricional legível na imagem. Tente uma foto mais nítida e enquadrada na tabela.',
        });
        return;
      }
      loadReview(data);
    } catch (err) {
      setStage({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Falha ao ler a imagem.',
      });
    }
  };

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
    if (servingNum !== null) payload.serving_size_g = servingNum;
    if (servingDesc.trim()) payload.serving_description = servingDesc.trim();

    upsertUserIngredient(payload);
    onSaved?.();
    onClose();
  };

  const unitSuffix = unit === 'ml' ? 'ml' : 'g';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 pt-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>
        <h2 className="flex-1 truncate text-base font-semibold text-zinc-100">
          Ler tabela nutricional
        </h2>
      </div>

      <div className="mx-auto mt-4 w-full max-w-md flex-1 overflow-y-auto px-4 pb-8">
        {/* Inputs de arquivo escondidos — acionados pelos botões. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {stage.kind === 'pick' && (
          <div className="mt-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/15 text-brand-300">
              <Icon name="sparkles" className="h-8 w-8" />
            </div>
            <p className="mb-1 text-sm text-zinc-200">
              Tire uma foto ou anexe uma imagem da tabela nutricional.
            </p>
            <p className="mb-6 text-xs text-zinc-400">
              A IA do Google Gemini vai ler os valores e você confere antes de salvar em{' '}
              <span className="font-medium text-zinc-200">{ingredient.name}</span>.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-sm font-medium text-white hover:bg-brand-600"
              >
                <Icon name="sparkles" className="h-5 w-5" />
                Tirar foto
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-800 px-5 py-3 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
              >
                <Icon name="upload" className="h-5 w-5" />
                Anexar imagem
              </button>
            </div>
            <p className="mt-6 text-[11px] leading-relaxed text-zinc-500">
              Dica: aproxime a câmera da tabela, com boa iluminação e sem reflexo.
              Use a coluna “por 100 {unitSuffix}” quando o rótulo tiver.
            </p>
          </div>
        )}

        {stage.kind === 'loading' && (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-brand-400" />
            <p className="text-sm text-zinc-300">Lendo a tabela nutricional…</p>
            <p className="mt-1 text-xs text-zinc-500">Isso pode levar alguns segundos.</p>
          </div>
        )}

        {stage.kind === 'error' && (
          <div className="mt-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <Icon name="alert-triangle" className="h-7 w-7" />
            </div>
            <p className="mb-6 text-sm text-zinc-200">{stage.message}</p>
            <button
              type="button"
              onClick={() => setStage({ kind: 'pick' })}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              <Icon name="rotate-ccw" className="h-4 w-4" />
              Tentar de novo
            </button>
          </div>
        )}

        {stage.kind === 'review' && (
          <div className="text-zinc-100">
            <div className="mb-4 rounded-xl bg-zinc-900 p-3 text-xs text-zinc-300">
              <p className="mb-1 flex items-center gap-1.5 font-medium text-zinc-100">
                <Icon name="check-circle" className="h-4 w-4 text-emerald-400" />
                Confira os valores antes de salvar
              </p>
              <p className="text-zinc-400">
                Valores por 100 {unitSuffix}. Corrija o que estiver errado — a leitura
                automática pode falhar.
              </p>
              {stage.data.normalizedFromServing && (
                <p className="mt-1.5 text-amber-300">
                  O rótulo só tinha valores por porção; converti para 100 {unitSuffix} usando
                  a porção de {stage.data.servingSizeG} {unitSuffix}. Revise com atenção.
                </p>
              )}
              {stage.data.notes && (
                <p className="mt-1.5 text-zinc-400">Obs. da IA: {stage.data.notes}</p>
              )}
            </div>

            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Base
              </span>
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
              <button
                type="button"
                onClick={() => setStage({ kind: 'pick' })}
                className="rounded-full bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700"
              >
                Outra foto
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
              >
                Salvar valores
              </button>
            </div>
          </div>
        )}
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
        className={`w-40 shrink-0 text-sm ${
          isSubrow ? 'pl-3 text-zinc-400' : 'text-zinc-300'
        }`}
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
