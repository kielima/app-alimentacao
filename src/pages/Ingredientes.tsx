import { useState } from 'react';
import { Link } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import { useIngredients, type IngredientFilter } from '../hooks/useIngredients';
import { upsertShoppingItem } from '../data/shoppingList';
import { upsertPantryItem } from '../data/pantry';
import type { Ingredient } from '../types/ingredient';

type AddedFlash = { id: string; action: 'cart' | 'pantry' } | null;

const filters: { value: IngredientFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'marcas', label: 'Marcas' },
  { value: 'genericos', label: 'Genéricos' },
];

export default function Ingredientes() {
  const { list, query, setQuery, filter, setFilter, total } = useIngredients();
  const [showFilters, setShowFilters] = useState(false);
  const [flash, setFlash] = useState<AddedFlash>(null);

  const hasActiveFilters = filter !== 'todos';
  const isFiltering = hasActiveFilters || !!query.trim();

  const flashAdded = (id: string, action: 'cart' | 'pantry') => {
    setFlash({ id, action });
    setTimeout(() => {
      setFlash((current) =>
        current && current.id === id && current.action === action ? null : current,
      );
    }, 1200);
  };

  const handleAddToCart = (ing: Ingredient) => {
    upsertShoppingItem({
      id: `from-ingredient-${ing.id}-${Date.now()}`,
      ingredient_id: ing.id,
      raw_text: ing.name,
      quantity: null,
      unit: ing.default_unit ?? null,
      store: null,
      price: null,
      checked: false,
      source: 'manual',
      source_ref: ing.id,
      added_at: new Date().toISOString(),
    });
    flashAdded(ing.id, 'cart');
  };

  const handleAddToPantry = (ing: Ingredient) => {
    upsertPantryItem({
      id: `from-ingredient-${ing.id}-${Date.now()}`,
      ingredient_id: ing.id,
      raw_text: ing.name,
      quantity: null,
      unit: ing.default_unit ?? null,
      expiry_date: null,
      store: null,
      added_at: new Date().toISOString(),
    });
    flashAdded(ing.id, 'pantry');
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-2">
      <HeaderSlot>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Buscar ingrediente…"
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
          {list.map((ing) => {
            const addedToCart = flash?.id === ing.id && flash.action === 'cart';
            const addedToPantry = flash?.id === ing.id && flash.action === 'pantry';
            return (
              <li key={ing.id}>
                <Link
                  to={`/ingredientes/${ing.id}`}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-brand-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-400"
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
                      className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      title="Valores nutricionais ainda precisam validação"
                    >
                      revisar
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddToPantry(ing);
                    }}
                    className={`shrink-0 rounded-full px-2 py-1 text-sm leading-none transition-colors ${
                      addedToPantry
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-zinc-100 text-zinc-500 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-brand-900/30 dark:hover:text-brand-400'
                    }`}
                    aria-label="Adicionar à dispensa"
                    title="Adicionar à dispensa"
                  >
                    {addedToPantry ? '✓' : '🥫'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddToCart(ing);
                    }}
                    className={`shrink-0 rounded-full px-2 py-1 text-sm leading-none transition-colors ${
                      addedToCart
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-zinc-100 text-zinc-500 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-brand-900/30 dark:hover:text-brand-400'
                    }`}
                    aria-label="Adicionar à lista de compras"
                    title="Adicionar à lista de compras"
                  >
                    {addedToCart ? '✓' : '🛒'}
                  </button>
                  <span className="text-zinc-400" aria-hidden>
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
