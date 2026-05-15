import { Link } from 'react-router-dom';
import { usePantry, type PantryFilter } from '../hooks/usePantry';
import { findIngredientById } from '../data/ingredients';
import { expiryStatus, expiryLabel, statusColor, statusIcon } from '../utils/expiry';
import { unitLabel } from '../utils/units';
import { upsertShoppingItem } from '../data/shoppingList';
import type { PantryItem } from '../types/pantry';

const filterChips: { value: PantryFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'expired', label: '❌ Vencidos' },
  { value: 'soon', label: '⚠️ Vencendo' },
  { value: 'fresh', label: '✅ Disponíveis' },
  { value: 'no-date', label: '— Sem data' },
];

export default function Dispensa() {
  const { list, query, setQuery, filter, setFilter, total, countsByStatus } = usePantry();

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
    alert(`"${item.raw_text}" adicionado à Lista de Compras`);
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-2">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          🥫
        </span>
        <h1 className="text-lg font-semibold">Dispensa</h1>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {list.length} de {total}
        </span>
        <Link
          to="/dispensa/novo"
          className="ml-auto rounded-full bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          + Novo
        </Link>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="🔍 Buscar na dispensa…"
        className="mb-3 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-base placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
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
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
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
            const ing = item.ingredient_id ? findIngredientById(item.ingredient_id) : undefined;
            const isExpiredOrSoon = status === 'expired' || status === 'soon';
            return (
              <li
                key={item.id}
                className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl" aria-hidden>
                    {statusIcon(status)}
                  </span>
                  <div className="min-w-0 flex-1">
                    {ing ? (
                      <Link
                        to={`/ingredientes/${ing.id}`}
                        className="block truncate text-sm font-medium hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        {item.raw_text}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-medium">{item.raw_text}</p>
                    )}
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
                  <div className="flex shrink-0 flex-col gap-1">
                    <Link
                      to={`/dispensa/${item.id}/editar`}
                      className="rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      aria-label="Editar"
                    >
                      ✏️
                    </Link>
                    {isExpiredOrSoon && (
                      <button
                        type="button"
                        onClick={() => sendToList(item)}
                        className="rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-brand-600 dark:hover:bg-zinc-800 dark:hover:text-brand-400"
                        aria-label="Enviar para Lista de Compras"
                        title="Enviar para Lista de Compras"
                      >
                        🛒
                      </button>
                    )}
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
