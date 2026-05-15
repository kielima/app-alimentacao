import type { Ingredient, NutritionPer100 } from '../types/ingredient';

const macroLabels: { key: keyof NutritionPer100; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calorias', unit: 'kcal' },
  { key: 'protein', label: 'Proteínas', unit: 'g' },
  { key: 'carbs', label: 'Carboidratos', unit: 'g' },
  { key: 'sugars', label: '— açúcares', unit: 'g' },
  { key: 'fat', label: 'Gorduras totais', unit: 'g' },
  { key: 'saturated_fat', label: '— saturadas', unit: 'g' },
  { key: 'fiber', label: 'Fibras', unit: 'g' },
  { key: 'sodium', label: 'Sódio', unit: 'mg' },
];

function fmt(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

function formatExtraKey(key: string): string {
  const cleaned = key.replace(/_(mg|ug|g)$/, '').replace(/_/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function inferUnitFromKey(key: string): string {
  if (key.endsWith('_mg')) return 'mg';
  if (key.endsWith('_ug')) return 'µg';
  if (key.endsWith('_g')) return 'g';
  return '';
}

export default function NutritionTable({ ingredient }: { ingredient: Ingredient }) {
  const n = ingredient.nutrition_per_100;
  const unitSuffix = ingredient.default_unit === 'ml' ? 'ml' : 'g';

  if (!n) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Sem dados nutricionais cadastrados.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
        Valores por 100{unitSuffix}
      </p>
      <table className="w-full text-sm">
        <tbody>
          {macroLabels.map(({ key, label, unit }) => {
            const val = n[key];
            if (val === null || val === undefined) return null;
            const isSubrow = label.startsWith('—');
            return (
              <tr
                key={key}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
              >
                <td
                  className={`py-1.5 text-zinc-700 dark:text-zinc-300 ${isSubrow ? 'pl-3 text-xs text-zinc-500 dark:text-zinc-400' : ''}`}
                >
                  {label}
                </td>
                <td className="py-1.5 text-right font-medium text-zinc-900 dark:text-zinc-100">
                  {fmt(val)} {unit}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {ingredient.extras_per_100 && Object.keys(ingredient.extras_per_100).length > 0 && (
        <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Micronutrientes
          </p>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(ingredient.extras_per_100).map(([k, v]) =>
                v == null ? null : (
                  <tr
                    key={k}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="py-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {formatExtraKey(k)}
                    </td>
                    <td className="py-1 text-right text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {fmt(v as number, 2)} {inferUnitFromKey(k)}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
