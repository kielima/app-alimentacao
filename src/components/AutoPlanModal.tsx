import { useState } from 'react';
import Icon from './Icon';
import { MEAL_TYPES, type PlanType } from '../types/mealPlan';
import { unitLabel } from '../utils/units';
import type { AutoPlanResult, AutoFillItem } from '../utils/autoPlan';

const slotMeta = (value: string) => MEAL_TYPES.find((m) => m.value === value);

/** Texto curto de validade a partir do menor nº de dias consumido. */
function expiryHint(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0) return 'vencido';
  if (days === 0) return 'vence hoje';
  if (days === 1) return 'vence amanhã';
  return `vence em ${days} dias`;
}

const round = (v: number) => Math.round(v);

/** "100 g", "1 unidade"… para a porção nominal. */
function portionLabel(quantity: number, unit: string): string {
  return `${quantity.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unitLabel(unit)}`;
}

function gapSummary(proteinGap: number, calorieGap: number): string {
  const parts: string[] = [];
  if (proteinGap > 0) parts.push(`${round(proteinGap)} g de proteína`);
  if (calorieGap > 0) parts.push(`${round(calorieGap)} kcal`);
  return parts.join(' e ');
}

export default function AutoPlanModal({
  result,
  dayLabel,
  planType,
  expiredIgnoredCount = 0,
  onApply,
  onClose,
}: {
  result: AutoPlanResult;
  dayLabel: string;
  planType: PlanType;
  /** Ingredientes desconsiderados por só terem itens vencidos na dispensa. */
  expiredIgnoredCount?: number;
  onApply: (selectedFillKeys: string[]) => void;
  onClose: () => void;
}) {
  const { slots, makeableCount, filledCount, gap } = result;
  const emptySlots = slots.length - filledCount;

  const allFill = slots.flatMap((s) => s.fillItems);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(allFill.map((f) => f.key)),
  );
  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const hasGap = gap.proteinGap > 0 || gap.calorieGap > 0;
  const nothingToPlan = makeableCount === 0 && allFill.length === 0;
  const canApply = filledCount > 0 || selected.size > 0;

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
            <h2 className="text-base font-semibold">Montar plano com a dispensa</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {dayLabel} · {planType === 'training_day' ? 'treino' : 'descanso'}
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

        {expiredIgnoredCount > 0 && (
          <div className="mb-3 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
            <Icon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {expiredIgnoredCount}{' '}
              {expiredIgnoredCount === 1
                ? 'ingrediente vencido foi desconsiderado'
                : 'ingredientes vencidos foram desconsiderados'}{' '}
              da dispensa.
            </span>
          </div>
        )}

        {nothingToPlan ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Nenhuma refeição pode ser montada com a dispensa atual.
            <br />
            Vincule os ingredientes das suas refeições e da dispensa a itens do
            catálogo para que o app possa cruzá-los.
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Icon name="package" className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
              <span>
                <strong>{makeableCount}</strong>{' '}
                {makeableCount === 1 ? 'refeição montável' : 'refeições montáveis'} · preenchendo{' '}
                <strong>{filledCount}</strong> de {slots.length}{' '}
                {slots.length === 1 ? 'horário' : 'horários'}
                {emptySlots > 0 && ` (${emptySlots} sem refeição)`}
              </span>
            </div>

            {hasGap && allFill.length > 0 && (
              <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                Faltam {gapSummary(gap.proteinGap, gap.calorieGap)}. Preenchi os horários vazios com
                itens da dispensa — desmarque o que não quiser. Quantidades equilibradas ao aplicar.
              </p>
            )}

            <ul className="space-y-1">
              {slots.map((slot) => (
                <SlotRow
                  key={slot.mealType}
                  slot={slot}
                  selected={selected}
                  onToggle={toggle}
                />
              ))}
            </ul>
          </>
        )}

        {(filledCount > 0 || allFill.length > 0) && (
          <div className="mt-3 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
            <Icon name="alert-triangle" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Isto <strong>substitui</strong> tudo o que já está neste dia.
            </span>
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
            onClick={() => onApply([...selected])}
            disabled={!canApply}
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            Aplicar (substitui o dia)
          </button>
        </div>
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  selected,
  onToggle,
}: {
  slot: AutoPlanResult['slots'][number];
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  const mt = slotMeta(slot.mealType);
  const hint = slot.meal ? expiryHint(slot.earliestDays) : null;
  const hasFill = slot.fillItems.length > 0;

  return (
    <li className="rounded-lg bg-zinc-50 dark:bg-zinc-950">
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Icon
          name={mt?.icon ?? 'utensils'}
          className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500"
        />
        <span className="w-24 shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
          {mt?.label ?? slot.mealType}
        </span>
        {slot.meal ? (
          <span className="min-w-0 flex-1 truncate font-medium">{slot.meal.name}</span>
        ) : hasFill ? (
          <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400 dark:text-zinc-500">
            combinar da dispensa:
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-zinc-400 dark:text-zinc-600">
            — sem opção
          </span>
        )}
        {slot.meal && slot.expiringConsumed > 0 && hint && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <Icon name="alert-triangle" className="h-3 w-3" />
            {hint}
          </span>
        )}
      </div>
      {hasFill && (
        <ul className="space-y-1 px-2 pb-2">
          {slot.meal && (
            <li className="px-1 pt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              + complementar:
            </li>
          )}
          {slot.fillItems.map((f) => (
            <FillRow
              key={f.key}
              item={f}
              checked={selected.has(f.key)}
              onToggle={() => onToggle(f.key)}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function FillRow({
  item,
  checked,
  onToggle,
}: {
  item: AutoFillItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const { kind, label, quantity, unit, macros, expiringConsumed, earliestDays } = item;
  const hint = expiringConsumed > 0 ? expiryHint(earliestDays) : null;
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-4 w-4 shrink-0 accent-brand-500"
        />
        <Icon
          name={kind === 'recipe' ? 'chef-hat' : 'carrot'}
          className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{label}</span>
          <span className="block text-[11px] text-zinc-400 dark:text-zinc-500">
            {portionLabel(quantity, unit)} · +{round(macros.protein)} g prot · +
            {round(macros.calories)} kcal
          </span>
        </span>
        {hint && (
          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <Icon name="alert-triangle" className="h-3 w-3" />
            {hint}
          </span>
        )}
      </label>
    </li>
  );
}
