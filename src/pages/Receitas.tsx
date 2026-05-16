import { useState } from 'react';
import { Link } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import { recipeCategories, useHiddenSeedRecipes } from '../data/recipes';
import { unhideRecipe } from '../data/hiddenRecipes';
import {
  useRecipes,
  type CompletenessFilter,
  type RatingFilter,
} from '../hooks/useRecipes';
import type { RecipeCategoryId } from '../types/recipe';

const categoryChips: { value: RecipeCategoryId | 'todas'; label: string; icon: string }[] = [
  { value: 'todas', label: 'Todas', icon: '✨' },
  ...recipeCategories.map((c) => ({ value: c.id, label: c.name, icon: c.icon })),
];

const completenessChips: { value: CompletenessFilter; label: string }[] = [
  { value: 'todas', label: 'Tudo' },
  { value: 'completas', label: 'Completas' },
  { value: 'revisao', label: 'Em revisão' },
];

const ratingChips: { value: RatingFilter; label: string }[] = [
  { value: 0, label: 'Qualquer' },
  { value: 3, label: '⭐ 3+' },
  { value: 4, label: '⭐ 4+' },
  { value: 5, label: '⭐ 5' },
];

export default function Receitas() {
  const {
    list,
    query,
    setQuery,
    category,
    setCategory,
    completeness,
    setCompleteness,
    minRating,
    setMinRating,
    total,
  } = useRecipes();

  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = category !== 'todas' || completeness !== 'todas' || minRating !== 0;
  const isFiltering = hasActiveFilters || !!query;

  return (
    <div className="mx-auto max-w-md px-4 pt-2 pb-28">
      <HeaderSlot>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Buscar receita…"
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
          {list.length} de {total} receita{total !== 1 ? 's' : ''}
        </p>
      )}

      {showFilters && (
        <div className="mb-3">
          <FilterRow label="Categoria">
            {categoryChips.map((c) => (
              <Chip key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
                <span aria-hidden>{c.icon}</span> {c.label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Status">
            {completenessChips.map((c) => (
              <Chip
                key={c.value}
                active={completeness === c.value}
                onClick={() => setCompleteness(c.value)}
              >
                {c.label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Avaliação">
            {ratingChips.map((r) => (
              <Chip key={r.value} active={minRating === r.value} onClick={() => setMinRating(r.value)}>
                {r.label}
              </Chip>
            ))}
          </FilterRow>
        </div>
      )}

      {list.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nenhuma receita encontrada com esses filtros.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((r) => {
            const cat = recipeCategories.find((c) => c.id === r.category);
            return (
              <li key={r.id}>
                <Link
                  to={`/receitas/${r.id}`}
                  className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-brand-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-400"
                >
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-3xl dark:bg-zinc-800"
                    aria-hidden
                  >
                    {cat?.icon ?? '🍽️'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{r.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {cat?.name}
                      {r.prep_time_min ? ` · ⏱ ${r.prep_time_min}min` : ''}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      {r.rating && (
                        <span className="text-xs text-amber-500" aria-label={`${r.rating} estrelas`}>
                          {'⭐'.repeat(r.rating)}
                        </span>
                      )}
                      {r.needs_review && (
                        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          revisar
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <HiddenRecipesPanel />

      <Link
        to="/receitas/nova"
        aria-label="Nova receita"
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-3xl font-bold text-white shadow-lg hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        +
      </Link>
    </div>
  );
}

function HiddenRecipesPanel() {
  const hidden = useHiddenSeedRecipes();
  const [open, setOpen] = useState(false);
  if (hidden.length === 0) return null;
  return (
    <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-zinc-500 hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
      >
        {open ? '▾' : '▸'} {hidden.length} receita(s) oculta(s)
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {hidden.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900"
            >
              <span className="flex-1 truncate text-zinc-500 line-through dark:text-zinc-400">
                {r.name}
              </span>
              <button
                type="button"
                onClick={() => unhideRecipe(r.id)}
                className="rounded-full bg-zinc-200/60 px-2 py-0.5 text-xs text-zinc-700 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-brand-900/30 dark:hover:text-brand-400"
                aria-label={`Restaurar ${r.name}`}
              >
                ↺ restaurar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-brand-500 text-white dark:bg-brand-600'
          : 'bg-zinc-200/60 text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60'
      }`}
    >
      {children}
    </button>
  );
}
