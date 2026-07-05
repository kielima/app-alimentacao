import { useState } from 'react';
import Icon from './Icon';
import type { NutritionBreakdown } from '../utils/nutrition';
import type { NutritionPer100 } from '../types/ingredient';

function fmt(value: number | undefined, digits = 0): string {
  if (value === undefined) return '—';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

const ROWS: { key: keyof NutritionPer100; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calorias', unit: 'kcal' },
  { key: 'protein', label: 'Proteínas', unit: 'g' },
  { key: 'carbs', label: 'Carboidratos', unit: 'g' },
  { key: 'fat', label: 'Gorduras', unit: 'g' },
  { key: 'fiber', label: 'Fibras', unit: 'g' },
  { key: 'sodium', label: 'Sódio', unit: 'mg' },
];

/**
 * Card "Nutrição (estimada)" com a tabela de macros/micros somados e a lista
 * expansível de itens ignorados. Usado tanto em receitas quanto em refeições.
 */
export default function NutritionEstimate({
  nutrition,
  totalLabel,
  itemNoun = 'ingrediente(s)',
}: {
  nutrition: NutritionBreakdown | null;
  totalLabel: string;
  itemNoun?: string;
}) {
  const [showSkipped, setShowSkipped] = useState(false);

  if (!nutrition || nutrition.counted === 0) return null;

  return (
    <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Nutrição (estimada)
      </h2>
      <table className="w-full text-sm">
        <tbody>
          {ROWS.map(({ key, label, unit }) => (
            <tr key={key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
              <td className="py-1.5 text-zinc-600 dark:text-zinc-300">{label}</td>
              <td className="py-1.5 text-right font-medium">
                {fmt(nutrition.totals[key], 1)} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        Total {totalLabel} somando {nutrition.counted} {itemNoun} com dados.
        {nutrition.skipped > 0 && (
          <>
            {' '}
            <button
              type="button"
              onClick={() => setShowSkipped((s) => !s)}
              className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"
            >
              <Icon
                name={showSkipped ? 'chevron-down' : 'chevron-right'}
                className="h-3.5 w-3.5"
              />{' '}
              {nutrition.skipped} ignorado(s)
            </button>
          </>
        )}
      </p>
      {showSkipped && nutrition.skipped > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          {nutrition.skippedReasons.map((s, i) => (
            <li key={i}>
              <span className="text-zinc-700 dark:text-zinc-300">{s.raw}</span> — {s.reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
