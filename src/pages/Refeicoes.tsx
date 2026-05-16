import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import SearchableSelect from '../components/SearchableSelect';
import { useAllMeals } from '../data/meals';
import { MEAL_TYPES, type MealType } from '../types/mealPlan';

type SlotFilter = 'todas' | MealType | 'sem-slot';

const slotOptions: { value: SlotFilter; label: string }[] = [
  { value: 'todas', label: '✨ Todas' },
  ...MEAL_TYPES.map((m) => ({ value: m.value as SlotFilter, label: `${m.icon} ${m.label}` })),
  { value: 'sem-slot', label: '➖ Sem slot' },
];

export default function Refeicoes() {
  const meals = useAllMeals();
  const [query, setQuery] = useState('');
  const [slot, setSlot] = useState<SlotFilter>('todas');
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = slot !== 'todas';
  const isFiltering = hasActiveFilters || !!query.trim();

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
    <div className="mx-auto max-w-md px-4 pt-2 pb-28">
      <HeaderSlot>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Buscar refeição…"
          className="h-9 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />
        <button
          type="button"
          onClick={() => setShowFilters((f) => !f)}
          aria-label="Filtros"
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg transition-colors ${
            showFilters
              ? 'bg-brand-500 dark:bg-brand-600'
              : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
          }`}
        >
          ⚙️
          {hasActiveFilters && !showFilters && (
            <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white dark:ring-zinc-950" />
          )}
        </button>
      </HeaderSlot>

      {isFiltering && (
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          {filtered.length} de {meals.length} refeição{meals.length !== 1 ? 'ões' : ''}
        </p>
      )}

      {showFilters && (
        <div className="mb-3">
          <FilterField label="Slot">
            <SearchableSelect
              value={slot}
              onChange={(v) => setSlot(v as SlotFilter)}
              options={slotOptions}
              className="text-sm"
            />
          </FilterField>
        </div>
      )}

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

      <Link
        to="/refeicoes/nova"
        aria-label="Nova refeição"
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-3xl font-bold text-white shadow-lg hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        +
      </Link>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      {children}
    </div>
  );
}
