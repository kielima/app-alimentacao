import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIngredients, type IngredientFilter } from '../hooks/useIngredients';

const filters: { value: IngredientFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'marcas', label: 'Marcas' },
  { value: 'genericos', label: 'Genéricos' },
];

export default function Ingredientes() {
  const { list, query, setQuery, filter, setFilter, total } = useIngredients();
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = filter !== 'todos';
  const isFiltering = hasActiveFilters || !!query.trim();

  return (
    <div className="mx-auto max-w-md px-4 pt-2">
      {/* ← | search | ⚙️ */}
      <div className="mb-2 flex items-center gap-2">
        <Link
          to="/receitas"
          aria-label="Voltar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          ←
        </Link>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Buscar ingrediente…"
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-base placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
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
      </div>

      {isFiltering && (
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          {list.length} de {total} ingrediente{total !== 1 ? 's' : ''}
        </p>
      )}

      {showFilters && (
        <div className="mb-3">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f.value
                    ? 'bg-brand-500 text-white dark:bg-brand-600'
                    : 'bg-zinc-200/60 text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nenhum ingrediente encontrado.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((ing) => (
            <li key={ing.id}>
              <Link
                to={`/ingredientes/${ing.id}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-brand-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-400"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{ing.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {ing.brand ? `${ing.brand} · ` : ''}
                    {ing.nutrition_per_100
                      ? `${ing.nutrition_per_100.calories} kcal/100${ing.default_unit === 'ml' ? 'ml' : 'g'}`
                      : 'sem dados nutricionais'}
                  </p>
                </div>
                {ing.needs_review && (
                  <span
                    className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    title="Valores nutricionais ainda precisam validação"
                  >
                    revisar
                  </span>
                )}
                <span className="ml-2 text-zinc-400" aria-hidden>
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
