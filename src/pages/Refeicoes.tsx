import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import FilterButton from '../components/FilterButton';
import { useAllMeals, allMealIds } from '../data/meals';
import { upsertUserMeal } from '../data/userMeals';
import { getMealSlots, type Meal } from '../types/meal';
import { MEAL_TYPES, type MealType } from '../types/mealPlan';
import { useLongPress } from '../hooks/useLongPress';
import { createUIStore } from '../utils/persistentUIState';
import { uniqueSlug } from '../utils/slug';

type SlotFilter = 'todas' | MealType | 'sem-slot';

const slotChips: { value: SlotFilter; label: string; icon: string }[] = [
  { value: 'todas', label: 'Todas', icon: '✨' },
  ...MEAL_TYPES.map((m) => ({ value: m.value as SlotFilter, label: m.label, icon: m.icon })),
  { value: 'sem-slot', label: 'Sem slot', icon: '➖' },
];

const ui = createUIStore({
  query: '',
  slot: 'todas' as SlotFilter,
  showFilters: false,
});

export default function Refeicoes() {
  const meals = useAllMeals();
  const { query, slot, showFilters } = ui.useStore();
  const setQuery = (q: string) => ui.set('query', q);
  const setSlot = (s: SlotFilter) => ui.set('slot', s);
  const setShowFilters = (s: boolean | ((prev: boolean) => boolean)) =>
    ui.set('showFilters', s);

  const [actionMealId, setActionMealId] = useState<string | null>(null);
  const actionMeal = actionMealId
    ? meals.find((m) => m.id === actionMealId) ?? null
    : null;

  const duplicateMeal = (meal: Meal) => {
    const baseName = `${meal.name} (cópia)`;
    const newId = uniqueSlug(baseName, allMealIds());
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const cloned: Meal = {
      ...meal,
      id: newId,
      name: baseName,
      items: meal.items.map((it, i) => ({
        ...it,
        id: `${it.id}-copy-${stamp}-${i}`,
      })),
    };
    upsertUserMeal(cloned);
    setActionMealId(null);
  };

  const hasActiveFilters = slot !== 'todas';
  const isFiltering = hasActiveFilters || !!query.trim();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meals
      .filter((m) => {
        const slots = getMealSlots(m);
        if (slot === 'sem-slot') return slots.length === 0;
        if (slot !== 'todas' && !slots.includes(slot)) return false;
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
          placeholder="Buscar refeição…"
          className="h-9 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />
        <FilterButton
          active={showFilters}
          hasActiveFilters={hasActiveFilters}
          onClick={() => setShowFilters((f) => !f)}
        />
      </HeaderSlot>

      {isFiltering && (
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          {filtered.length} de {meals.length} refeição{meals.length !== 1 ? 'ões' : ''}
        </p>
      )}

      {showFilters && (
        <div className="sticky top-0 z-10 -mx-4 mb-3 bg-zinc-50/95 px-4 pb-2 pt-2 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/80">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {slotChips.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSlot(c.value)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  slot === c.value
                    ? 'bg-brand-500 text-white dark:bg-brand-600'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <span aria-hidden>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nenhuma refeição encontrada com esses filtros.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <MealCard
              key={m.id}
              meal={m}
              onLongPress={() => setActionMealId(m.id)}
            />
          ))}
        </ul>
      )}

      {actionMeal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ações da refeição"
          className="fixed inset-0 z-[70] flex items-end justify-center"
          onClick={() => setActionMealId(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative mx-auto w-full max-w-md p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
              <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Refeição
                </p>
                <p className="truncate text-base font-medium">{actionMeal.name}</p>
              </div>
              <button
                type="button"
                onClick={() => duplicateMeal(actionMeal)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <span aria-hidden className="text-lg">📋</span>
                <span>Duplicar refeição</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setActionMealId(null)}
              className="mt-2 w-full rounded-2xl bg-white py-3 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <Link
        to="/refeicoes/nova"
        aria-label="Nova refeição"
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-cream text-brand-700 shadow-lg hover:bg-brand-100 dark:bg-brand-cream dark:text-brand-700 dark:hover:bg-brand-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="h-7 w-7"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
    </div>
  );
}

function MealCard({ meal, onLongPress }: { meal: Meal; onLongPress: () => void }) {
  const longPress = useLongPress(onLongPress, { delay: 450 });
  const slots = getMealSlots(meal);
  const slotDefs = slots
    .map((s) => MEAL_TYPES.find((t) => t.value === s))
    .filter((t): t is (typeof MEAL_TYPES)[number] => !!t);
  const iconStack = slotDefs.length > 0 ? slotDefs.map((s) => s.icon).join('') : '🍽️';
  const slotsLabel =
    slotDefs.length === 0 ? 'Sem slot' : slotDefs.map((s) => s.label).join(' · ');
  const recipes = meal.items.filter((i) => i.kind === 'recipe').length;
  const ingredients = meal.items.filter((i) => i.kind === 'ingredient').length;

  return (
    <li>
      <Link
        to={`/refeicoes/${meal.id}`}
        {...longPress}
        className="flex select-none items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-brand-500 [-webkit-touch-callout:none] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-400"
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-2xl dark:bg-zinc-800"
          aria-hidden
        >
          {iconStack}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{meal.name}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {slotsLabel} ·{' '}
            {recipes ? `${recipes} receita${recipes > 1 ? 's' : ''}` : ''}
            {recipes && ingredients ? ' + ' : ''}
            {ingredients ? `${ingredients} ingrediente${ingredients > 1 ? 's' : ''}` : ''}
            {!recipes && !ingredients ? 'sem itens' : ''}
          </p>
        </div>
      </Link>
    </li>
  );
}
