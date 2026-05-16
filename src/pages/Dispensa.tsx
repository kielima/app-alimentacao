import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import { usePantry, type PantryFilter } from '../hooks/usePantry';
import { expiryStatus, expiryLabel, statusColor, statusIcon } from '../utils/expiry';
import { unitLabel } from '../utils/units';
import { upsertShoppingItem } from '../data/shoppingList';
import { deletePantryItem } from '../data/pantry';
import type { PantryItem } from '../types/pantry';

const filterChips: { value: PantryFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'expired', label: '❌ Vencidos' },
  { value: 'soon', label: '⚠️ Vencendo' },
  { value: 'fresh', label: '✅ Disponíveis' },
  { value: 'no-date', label: '— Sem data' },
];

export default function Dispensa() {
  const navigate = useNavigate();
  const { list, query, setQuery, filter, setFilter, total, countsByStatus } = usePantry();
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = filter !== 'todos';
  const isFiltering = hasActiveFilters || !!query.trim();

  const sendToList = (item: PantryItem) => {
    upsertShoppingItem({
      id: `from-pantry-${item.id}-${Date.now()}`,
      ingredient_id: item.ingredient_id,
      raw_text: item.raw_text,
      quantity: item.quantity,
      unit: item.unit,
      store: item.store,
      price: null,
      checked: false,
      source: 'from_pantry',
      source_ref: item.id,
      added_at: new Date().toISOString(),
    });
    deletePantryItem(item.id);
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-2 pb-28">
      <HeaderSlot>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Buscar na dispensa…"
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
          {list.length} de {total} item{total !== 1 ? 's' : ''}
        </p>
      )}

      {showFilters && (
        <div className="mb-3">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filterChips.map((c) => {
              const count =
                c.value === 'todos'
                  ? total
                  : countsByStatus[c.value as Exclude<PantryFilter, 'todos'>];
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setFilter(c.value)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === c.value
                      ? 'bg-brand-500 text-white dark:bg-brand-600'
                      : 'bg-zinc-200/60 text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60'
                  }`}
                >
                  {c.label} {count > 0 && <span className="opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Link
        to="/dispensa/novo"
        aria-label="Novo item na dispensa"
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-3xl font-bold text-white shadow-lg hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        +
      </Link>

      {total === 0 ? (
        <div className="mt-12 text-center">
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Sua dispensa está vazia.
          </p>
          <Link
            to="/dispensa/novo"
            className="inline-block rounded-full bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            + Adicionar primeiro item
          </Link>
        </div>
      ) : list.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nenhum item nesse filtro.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((item) => {
            const status = expiryStatus(item.expiry_date);
            return (
              <li key={item.id}>
                <div
                  role="button"
                  onClick={() => navigate(`/dispensa/${item.id}/editar`)}
                  className="cursor-pointer rounded-xl border border-zinc-200 bg-white p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl" aria-hidden>
                      {statusIcon(status)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.raw_text}</span>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {item.quantity && item.unit
                          ? `${item.quantity} ${unitLabel(item.unit)}`
                          : item.quantity ?? ''}
                        {item.store && ` · ${item.store}`}
                      </p>
                      <p className={`mt-0.5 text-xs font-medium ${statusColor(status)}`}>
                        {expiryLabel(item.expiry_date)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        sendToList(item);
                      }}
                      className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-sm leading-none text-zinc-500 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-brand-900/30 dark:hover:text-brand-400"
                      aria-label="Adicionar à lista de compras"
                      title="Adicionar à lista de compras"
                    >
                      🛒
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
