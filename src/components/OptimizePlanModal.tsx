import Icon from './Icon';
import { MEAL_TYPES, type PlanType } from '../types/mealPlan';
import { KCAL_TOLERANCE } from '../utils/profileTargets';
import { unitLabel } from '../utils/units';
import type { Macros, OptimizeResult } from '../utils/planOptimizer';

const mealLabel = (value: string) =>
  MEAL_TYPES.find((m) => m.value === value)?.label ?? value;

const fmt = (v: number, d = 0) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 });

/** Formata a quantidade de um item: gramas, medida (unidade/fatia…) ou ×N de porção. */
function formatQty(unit: string | null, value: number): string {
  if (unit === '×') return `×${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`;
  if (unit === 'g' || unit === 'ml') return `${fmt(value)} ${unit}`;
  const n = value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return unit ? `${n} ${unitLabel(unit)}` : n;
}

function DeltaRow({
  label,
  before,
  after,
  unit,
  target,
  ok,
}: {
  label: string;
  before: number;
  after: number;
  unit: string;
  target?: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="flex items-center gap-1.5 tabular-nums">
        <span className="text-zinc-400 line-through dark:text-zinc-500">
          {fmt(before)} {unit}
        </span>
        <Icon name="arrow-right" className="h-3.5 w-3.5 text-zinc-400" />
        <span className="font-semibold">
          {fmt(after)} {unit}
        </span>
        {target && (
          <span
            className={`ml-1 inline-flex items-center gap-0.5 text-[11px] ${
              ok
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            <Icon name={ok ? 'check' : 'alert-triangle'} className="h-3 w-3" />
            {target}
          </span>
        )}
      </span>
    </div>
  );
}

export default function OptimizePlanModal({
  result,
  dayLabel,
  planType,
  onApply,
  onClose,
}: {
  result: OptimizeResult;
  dayLabel: string;
  planType: PlanType;
  onApply: () => void;
  onClose: () => void;
}) {
  const { target, before, after, changed, meetsCalories, meetsProtein, notes } = result;
  const macroOk = (key: keyof Macros) => {
    if (key === 'calories') return meetsCalories;
    if (key === 'protein') return meetsProtein;
    return undefined;
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Ajustar para a meta</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {dayLabel} · {planType === 'training_day' ? 'treino' : 'descanso'} · meta{' '}
              {fmt(target.calories)} kcal / ≥{fmt(target.proteinMin)} g proteína
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {/* Totais antes → depois */}
        <div className="space-y-1.5 rounded-xl bg-zinc-100 px-3 py-3 dark:bg-zinc-800">
          <DeltaRow
            label="Calorias"
            before={before.calories}
            after={after.calories}
            unit="kcal"
            target={`meta ±${KCAL_TOLERANCE}`}
            ok={macroOk('calories')}
          />
          <DeltaRow
            label="Proteína"
            before={before.protein}
            after={after.protein}
            unit="g"
            target={`mín. ${fmt(target.proteinMin)}`}
            ok={macroOk('protein')}
          />
          <DeltaRow label="Carbo" before={before.carbs} after={after.carbs} unit="g" />
          <DeltaRow label="Gordura" before={before.fat} after={after.fat} unit="g" />
        </div>

        {/* Itens alterados */}
        <div className="mt-3">
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {changed.length > 0 ? `Quantidades ajustadas (${changed.length})` : 'Sem ajustes de quantidade'}
          </h3>
          {changed.length > 0 ? (
            <ul className="space-y-1">
              {changed.map((item) => (
                <li
                  key={item.itemId}
                  className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 text-sm dark:bg-zinc-950"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{item.label}</span>{' '}
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      {mealLabel(item.mealType)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                    <span className="line-through">
                      {formatQty(item.unit, item.currentQuantity ?? 0)}
                    </span>{' '}
                    →{' '}
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                      {formatQty(item.unit, item.suggestedQuantity ?? 0)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              O dia já está dentro da meta — nada a ajustar.
            </p>
          )}
        </div>

        {/* Avisos / sugestões de troca */}
        {notes.length > 0 && (
          <div className="mt-3 space-y-2">
            {notes.map((note, i) => (
              <div
                key={i}
                className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
              >
                <Icon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{note}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={changed.length === 0}
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            Aplicar ajustes
          </button>
        </div>
      </div>
    </div>
  );
}
