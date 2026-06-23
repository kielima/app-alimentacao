import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import ScanButton from '../components/ScanButton';
import FilterButton from '../components/FilterButton';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import CardActionSheet from '../components/CardActionSheet';
import TrashIcon from '../components/TrashIcon';
import { usePantry, type PantryFilter } from '../hooks/usePantry';
import { useLongPress } from '../hooks/useLongPress';
import { expiryStatus, expiryLabel, statusColor, statusIcon } from '../utils/expiry';
import Icon from '../components/Icon';
import { unitLabel } from '../utils/units';
import { upsertShoppingItem } from '../data/shoppingList';
import { upsertPantryItem, deletePantryItem } from '../data/pantry';
import { useAllIngredients } from '../data/ingredients';
import { handleScanForPantry } from '../lib/scanActions';
import type { PantryItem } from '../types/pantry';

const filterChips: { value: PantryFilter; label: string; icon: string | null }[] = [
  { value: 'todos', label: 'Todos', icon: null },
  { value: 'expired', label: 'Vencidos', icon: 'x-circle' },
  { value: 'soon', label: 'Vencendo', icon: 'alert-triangle' },
  { value: 'fresh', label: 'Disponíveis', icon: 'check-circle' },
  { value: 'no-date', label: 'Sem data', icon: null },
];

export default function Dispensa() {
  const navigate = useNavigate();
  const allIngredients = useAllIngredients();
  const [scanOpen, setScanOpen] = useState(false);
  const {
    list,
    query,
    setQuery,
    filter,
    setFilter,
    kindFilter,
    setKindFilter,
    showFilters,
    setShowFilters,
    total,
    countsByStatus,
    kindCounts,
  } = usePantry();

  const hasActiveFilters = filter !== 'todos' || kindFilter !== 'all';
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
      kind: item.kind,
    });
    deletePantryItem(item.id);
  };

  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const actionItem = actionItemId
    ? list.find((i) => i.id === actionItemId) ?? null
    : null;

  const duplicatePantryItem = (item: PantryItem) => {
    const newId = `pantry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    upsertPantryItem({
      ...item,
      id: newId,
      added_at: new Date().toISOString(),
    });
    setActionItemId(null);
  };

  const removePantryItem = (item: PantryItem) => {
    if (!confirm(`Apagar "${item.raw_text}" da dispensa? Esta ação não pode ser desfeita.`)) return;
    deletePantryItem(item.id);
    setActionItemId(null);
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-2 pb-28">
      <HeaderSlot>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar na dispensa…"
          className="h-9 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />
        <ScanButton onClick={() => setScanOpen(true)} />
        <FilterButton
          active={showFilters}
          hasActiveFilters={hasActiveFilters}
          onClick={() => setShowFilters((f) => !f)}
        />
      </HeaderSlot>

      <BarcodeScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        actions={['add-pantry', 'manual-not-found']}
        onPick={(result, action) => {
          setScanOpen(false);
          handleScanForPantry(result, action, allIngredients, navigate);
        }}
      />

      {isFiltering && (
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          {list.length} de {total} item{total !== 1 ? 's' : ''}
        </p>
      )}

      {showFilters && (
        <div className="sticky top-0 z-10 -mx-4 mb-3 space-y-1.5 bg-zinc-50/95 px-4 pb-2 pt-2 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/80">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([
              { value: 'all', label: 'Tudo', icon: null, count: total },
              { value: 'food', label: 'Comida', icon: 'utensils-crossed', count: kindCounts.food },
              { value: 'household', label: 'Casa', icon: 'package', count: kindCounts.household },
            ] as const).map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setKindFilter(c.value)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  kindFilter === c.value
                    ? 'bg-brand-500 text-white dark:bg-brand-600'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {c.icon && <Icon name={c.icon} className="h-3.5 w-3.5" />}
                {c.label} {c.count > 0 && <span className="opacity-70">({c.count})</span>}
              </button>
            ))}
          </div>
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
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === c.value
                      ? 'bg-brand-500 text-white dark:bg-brand-600'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {c.icon && <Icon name={c.icon} className="h-3.5 w-3.5" />}
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
          {list.map((item) => (
            <PantryCard
              key={item.id}
              item={item}
              onOpen={() => navigate(`/dispensa/${item.id}/editar`)}
              onSendToList={() => sendToList(item)}
              onLongPress={() => setActionItemId(item.id)}
            />
          ))}
        </ul>
      )}

      {actionItem && (
        <CardActionSheet
          category="Item da dispensa"
          title={actionItem.raw_text}
          onClose={() => setActionItemId(null)}
          actions={[
            {
              label: 'Duplicar item',
              icon: <Icon name="clipboard" className="h-4 w-4" />,
              onClick: () => duplicatePantryItem(actionItem),
            },
            {
              label: 'Apagar item',
              icon: <TrashIcon className="h-4 w-4" />,
              onClick: () => removePantryItem(actionItem),
              destructive: true,
            },
          ]}
        />
      )}
    </div>
  );
}

interface PantryCardProps {
  item: PantryItem;
  onOpen: () => void;
  onSendToList: () => void;
  onLongPress: () => void;
}

function PantryCard({ item, onOpen, onSendToList, onLongPress }: PantryCardProps) {
  const longPress = useLongPress(onLongPress, { delay: 450 });
  const status = expiryStatus(item.expiry_date);
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        {...longPress}
        onClick={(e) => {
          longPress.onClick(e);
          if (!e.defaultPrevented) onOpen();
        }}
        className="cursor-pointer select-none rounded-xl border border-zinc-200 bg-white p-3 hover:bg-zinc-50 [-webkit-touch-callout:none] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
      >
        <div className="flex items-start gap-2">
          {statusIcon(status) ? (
            <Icon name={statusIcon(status)!} className={`h-5 w-5 shrink-0 ${statusColor(status)}`} />
          ) : (
            <span className={`text-xl leading-none ${statusColor(status)}`} aria-hidden>
              —
            </span>
          )}
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{item.raw_text}</span>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
              {item.kind === 'household' && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Icon name="package" className="h-3.5 w-3.5" /> Casa
                </span>
              )}
              <span>
                {item.quantity && item.unit
                  ? `${item.quantity} ${unitLabel(item.unit)}`
                  : item.quantity ?? ''}
                {item.store && ` · ${item.store}`}
              </span>
            </p>
            <p className={`mt-0.5 text-xs font-medium ${statusColor(status)}`}>
              {expiryLabel(item.expiry_date)}
            </p>
          </div>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSendToList();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm leading-none text-zinc-500 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-brand-900/30 dark:hover:text-brand-400"
            aria-label="Adicionar à lista de compras"
            title="Adicionar à lista de compras"
          >
            <Icon name="shopping-cart" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
