import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllMeals } from '../data/meals';
import { MEAL_TYPES, type MealType } from '../types/mealPlan';

type SlotFilter = 'todas' | MealType | 'sem-slot';

const slotChips: { value: SlotFilter; label: string; icon: string }[] = [
  { value: 'todas', label: 'Todas', icon: '✨' },
  ...MEAL_TYPES.map((m) => ({ value: m.value as SlotFilter, label: m.label, icon: m.icon })),
  { value: 'sem-slot', label: 'Sem slot', icon: '➖' },
];

export default function Refeicoes() {
  const meals = useAllMeals();
  const [query, setQuery] = useState('');
  const [slot, setSlot] = useState<SlotFilter>('todas');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meals
      .filter((m) => {
        if (slot === 'sem-slot') return !m.meal_type;
        if (slot !== 'todas' && m.meal_type !== slot) return false;
        return true;
      })
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [meals, query, slot]);

  return (
    <div className="mx-auto max-w-md px-4 pt-2">
      <div className="mb-3 flex items-center gap-2">
        <Link
          to="/plano"
          className="rounded-full bg-zinc-200/60 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
        >
          ← Plano
        </Link>
        <h1 className="text-lg font-semibold">🍽️ Refeições</h1>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {filtered.length} de {meals.length}
        </span>
        <Link
          to="/refeicoes/nova"
          className="ml-auto rounded-full bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          + Nova
        </Link>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 Buscar refeição…"
        className="mb-3 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-base placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
      />

      <div className="mb-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Slot
        </p>
        <div className="flex flex-wrap gap-1.5">
          {slotChips.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setSlot(c.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                slot === c.value
                  ? 'bg-brand-500 text-white dark:bg-brand-600'
                  : 'bg-zinc-200/60 text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60'
              }`}
            >
              <span aria-hidden>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nenhuma refeição encontrada com esses filtros.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => {
            const slotDef = MEAL_TYPES.find((t) => t.value === m.meal_type);
            const recipes = m.items.filter((i) => i.kind === 'recipe').length;
            const ingredients = m.items.filter((i) => i.kind === 'ingredient').length;
            return (
              <li key={m.id}>
                <Link
                  to={`/refeicoes/${m.id}`}
                  className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-brand-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-400"
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-2xl dark:bg-zinc-800"
                    aria-hidden
                  >
                    {slotDef?.icon ?? '🍽️'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{m.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {slotDef?.label ?? 'Sem slot'} ·{' '}
                      {recipes ? `${recipes} receita${recipes > 1 ? 's' : ''}` : ''}
                      {recipes && ingredients ? ' + ' : ''}
                      {ingredients ? `${ingredients} ingrediente${ingredients > 1 ? 's' : ''}` : ''}
                      {!recipes && !ingredients ? 'sem itens' : ''}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
