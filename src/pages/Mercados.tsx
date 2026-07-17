import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import CardActionSheet from '../components/CardActionSheet';
import TrashIcon from '../components/TrashIcon';
import Icon from '../components/Icon';
import { useMarkets, upsertMarket, deleteMarket } from '../data/markets';
import { useHouseholdItems } from '../data/householdItems';
import { useAllIngredients } from '../data/ingredients';
import { useLongPress } from '../hooks/useLongPress';
import { createUIStore } from '../utils/persistentUIState';
import type { Market } from '../types/market';

const ui = createUIStore({ query: '' });

export default function Mercados() {
  const markets = useMarkets();
  const allIng = useAllIngredients();
  const householdItems = useHouseholdItems();
  const navigate = useNavigate();
  const { query } = ui.useStore();
  const setQuery = (q: string) => ui.set('query', q);

  const ingNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const ing of allIng) {
      m.set(ing.id, ing.brand ? `${ing.brand} — ${ing.name}` : ing.name);
    }
    return m;
  }, [allIng]);

  const shoppingByStore = useMemo(() => {
    const map = new Map<string, number>();
    const comprarItems = [
      ...allIng.filter((i) => i.status === 'comprar'),
      ...householdItems.filter((i) => i.status === 'comprar'),
    ];
    for (const item of comprarItems) {
      for (const store of item.stores ?? []) {
        map.set(store, (map.get(store) ?? 0) + 1);
      }
    }
    return map;
  }, [allIng, householdItems]);

  const filtered = useMemo(() => {
    const sorted = [...markets].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (m) => m.name.toLowerCase().includes(q) || m.address?.toLowerCase().includes(q),
    );
  }, [markets, query]);

  const [actionMarketId, setActionMarketId] = useState<string | null>(null);
  const actionMarket = actionMarketId
    ? markets.find((m) => m.id === actionMarketId) ?? null
    : null;

  const duplicateMarket = (market: Market) => {
    const newId = `market-${Date.now()}`;
    upsertMarket({
      ...market,
      id: newId,
      name: `${market.name} (cópia)`,
      added_at: new Date().toISOString(),
    });
    setActionMarketId(null);
  };

  const removeMarket = (market: Market) => {
    if (!confirm(`Apagar o mercado "${market.name}"? Esta ação não pode ser desfeita.`)) return;
    deleteMarket(market.id);
    setActionMarketId(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-2 pb-28">
      <button
        type="button"
        onClick={() => navigate('/mercados/novo')}
        aria-label="Adicionar mercado"
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-cream text-brand-700 shadow-lg hover:bg-brand-100 dark:bg-brand-cream dark:text-brand-700 dark:hover:bg-brand-100"
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
      </button>

      <HeaderSlot>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar mercado…"
          className="h-9 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />
      </HeaderSlot>

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
              <span className="inline-flex items-center gap-1">
                Adicionar primeiro mercado
                <Icon name="arrow-right" className="h-4 w-4" />
              </span>
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              shopCount={shoppingByStore.get(market.name) ?? 0}
              ingNames={market.ingredient_ids
                .slice(0, 3)
                .map((id) => ingNameMap.get(id))
                .filter((n): n is string => !!n)}
              onLongPress={() => setActionMarketId(market.id)}
            />
          ))}
        </ul>
      )}

      {actionMarket && (
        <CardActionSheet
          category="Mercado"
          title={actionMarket.name}
          onClose={() => setActionMarketId(null)}
          actions={[
            {
              label: 'Duplicar mercado',
              icon: <Icon name="clipboard" className="h-4 w-4" />,
              onClick: () => duplicateMarket(actionMarket),
            },
            {
              label: 'Apagar mercado',
              icon: <TrashIcon className="h-4 w-4" />,
              onClick: () => removeMarket(actionMarket),
              destructive: true,
            },
          ]}
        />
      )}
    </div>
  );
}

interface MarketCardProps {
  market: Market;
  shopCount: number;
  ingNames: string[];
  onLongPress: () => void;
}

function MarketCard({ market, shopCount, ingNames, onLongPress }: MarketCardProps) {
  const longPress = useLongPress(onLongPress, { delay: 450 });
  const ingCount = market.ingredient_ids.length;
  return (
    <li>
      <Link
        to={`/mercados/${market.id}/editar`}
        {...longPress}
        className="flex select-none items-start justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-brand-500 [-webkit-touch-callout:none] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-400"
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
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Icon name="shopping-cart" className="h-4 w-4" />
                {shopCount} na lista
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
}
