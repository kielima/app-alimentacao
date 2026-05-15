import { useState } from 'react';
import { Link } from 'react-router-dom';
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

  return (
    <div className="mx-auto max-w-md px-4 pt-2">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          🍳
        </span>
        <h1 className="text-lg font-semibold">Receitas</h1>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {list.length} de {total}
        </span>
        <Link
          to="/receitas/nova"
          className="ml-auto rounded-full bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          + Nova
        </Link>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 Buscar receita…"
        className="mb-3 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-base placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
      />

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

      <div className="mt-2 mb-4">
        <Link
          to="/ingredientes"
          className="text-xs text-brand-600 hover:underline dark:text-brand-400"
        >
          🥕 Ver base de ingredientes →
        </Link>
      </div>

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
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-brand-500 text-white dark:bg-brand-600'
          : 'bg-zinc-200/60 text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60'
      }`}
    >
      {children}
    </button>
  );
}
