import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMarkets } from '../data/markets';
import { useShoppingItems } from '../data/shoppingList';
import { useAllIngredients } from '../data/ingredients';

export default function Mercados() {
  const markets = useMarkets();
  const shoppingItems = useShoppingItems();
  const allIng = useAllIngredients();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const ingNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const ing of allIng) {
      m.set(ing.id, ing.brand ? `${ing.brand} — ${ing.name}` : ing.name);
    }
    return m;
  }, [allIng]);

  const shoppingByStore = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of shoppingItems) {
      if (item.store) map.set(item.store, (map.get(item.store) ?? 0) + 1);
    }
    return map;
  }, [shoppingItems]);

  const filtered = useMemo(() => {
    const sorted = [...markets].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (m) => m.name.toLowerCase().includes(q) || m.address?.toLowerCase().includes(q),
    );
  }, [markets, query]);

  return (
    <div className="mx-auto max-w-md px-4 pt-2 pb-28">
      <button
        type="button"
        onClick={() => navigate('/mercados/novo')}
        aria-label="Adicionar mercado"
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-3xl font-bold text-white shadow-lg hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        +
      </button>

      <div className="mb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Buscar mercado…"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-base placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />
      </div>

      {markets.length > 0 && (
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          {filtered.length} mercado{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
            {markets.length === 0 ? 'Nenhum mercado cadastrado.' : 'Nenhum resultado encontrado.'}
          </p>
          {markets.length === 0 && (
            <button
              type="button"
              onClick={() => navigate('/mercados/novo')}
              className="text-sm text-brand-600 hover:underline dark:text-brand-400"
            >
              Adicionar primeiro mercado →
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((market) => {
            const ingCount = market.ingredient_ids.length;
            const shopCount = shoppingByStore.get(market.name) ?? 0;
            const ingNames = market.ingredient_ids
              .slice(0, 3)
              .map((id) => ingNameMap.get(id))
              .filter(Boolean);
            return (
              <li key={market.id}>
                <Link
                  to={`/mercados/${market.id}/editar`}
                  className="flex items-start justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-brand-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-400"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{market.name}</p>
                    {market.address && (
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {market.address}
                      </p>
                    )}
                    {ingNames.length > 0 && (
                      <p className="mt-0.5 truncate text-[11px] text-zinc-400 dark:text-zinc-500">
                        {ingNames.join(' · ')}
                        {ingCount > 3 ? ` +${ingCount - 3}` : ''}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-2">
                      {ingCount > 0 && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          {ingCount} ingrediente{ingCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {shopCount > 0 && (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                          🛒 {shopCount} na lista
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="ml-2 mt-0.5 shrink-0 text-zinc-400" aria-hidden>
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
