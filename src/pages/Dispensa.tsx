import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import ScanButton from '../components/ScanButton';
import FilterButton from '../components/FilterButton';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import CardActionSheet from '../components/CardActionSheet';
import TrashIcon from '../components/TrashIcon';
import Icon from '../components/Icon';
import {
  useDispensa,
  itemStatus,
  itemDisplayName,
  itemExpiry,
  itemUnit,
  type DispensaItem,
  type DispensaKindFilter,
  type ExpiryFilter,
} from '../hooks/useDispensa';
import { useLongPress } from '../hooks/useLongPress';
import { expiryStatus, expiryLabel, statusColor, statusIcon } from '../utils/expiry';
import { unitLabel } from '../utils/units';
import { useAllIngredients, allIngredientIds } from '../data/ingredients';
import { upsertUserIngredient, deleteUserIngredient } from '../data/userIngredients';
import { upsertHouseholdItem, deleteHouseholdItem } from '../data/householdItems';
import { handleScanForPantry } from '../lib/scanActions';
import { uniqueSlug } from '../utils/slug';
import { DISPENSA_STATUSES, dispensaStatusLabel, type DispensaStatus } from '../types/dispensaStatus';

const expiryChips: { value: ExpiryFilter; label: string; icon: string | null }[] = [
  { value: 'todos', label: 'Todos', icon: null },
  { value: 'expired', label: 'Vencidos', icon: 'x-circle' },
  { value: 'soon', label: 'Vencendo', icon: 'alert-triangle' },
  { value: 'fresh', label: 'Disponíveis', icon: 'check-circle' },
  { value: 'no-expiry', label: 'Sem validade', icon: 'check-circle' },
  { value: 'no-date', label: 'Sem data', icon: null },
];

export default function Dispensa() {
  const navigate = useNavigate();
  const allIngredients = useAllIngredients();
  const [scanOpen, setScanOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const {
    list,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    kindFilter,
    setKindFilter,
    expiryFilter,
    setExpiryFilter,
    showFilters,
    setShowFilters,
    total,
    statusCounts,
    kindCounts,
    expiryCounts,
  } = useDispensa();

  const showExpiryFilters = statusFilter === 'todos' || statusFilter === 'dispensa';
  const hasActiveFilters =
    statusFilter !== 'todos' || kindFilter !== 'all' || expiryFilter !== 'todos';
  const isFiltering = hasActiveFilters || !!query.trim();

  const [actionItemKey, setActionItemKey] = useState<string | null>(null);
  const actionItem = actionItemKey
    ? list.find((i) => `${i.kind}-${i.data.id}` === actionItemKey) ?? null
    : null;

  const changeStatus = (item: DispensaItem, status: DispensaStatus) => {
    if (item.kind === 'ingredient') {
      upsertUserIngredient({ ...item.data, status });
    } else {
      upsertHouseholdItem({ ...item.data, status });
    }
    setActionItemKey(null);
  };

  const duplicateItem = (item: DispensaItem) => {
    if (item.kind === 'ingredient') {
      const ing = item.data;
      const newId = uniqueSlug(`${ing.name} (cópia)`, allIngredientIds());
      upsertUserIngredient({ ...ing, id: newId, name: `${ing.name} (cópia)` });
    } else {
      const newId = `household-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      upsertHouseholdItem({ ...item.data, id: newId, added_at: new Date().toISOString() });
    }
    setActionItemKey(null);
  };

  const removeItem = (item: DispensaItem) => {
    if (!confirm(`Apagar "${itemDisplayName(item)}"? Esta ação não pode ser desfeita.`)) return;
    if (item.kind === 'ingredient') deleteUserIngredient(item.data.id);
    else deleteHouseholdItem(item.data.id);
    setActionItemKey(null);
  };

  const openItem = (item: DispensaItem) => {
    if (item.kind === 'ingredient') navigate(`/ingredientes/${item.data.id}/editar`);
    else navigate(`/dispensa/${item.data.id}/editar`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-2 pb-28">
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
            <button
              type="button"
              onClick={() => setStatusFilter('todos')}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === 'todos'
                  ? 'bg-brand-500 text-white dark:bg-brand-600'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              Todos {total > 0 && <span className="opacity-70">({total})</span>}
            </button>
            {DISPENSA_STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatusFilter(s.value)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === s.value
                    ? 'bg-brand-500 text-white dark:bg-brand-600'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Icon name={s.icon} className="h-3.5 w-3.5" />
                {s.label}{' '}
                {statusCounts[s.value] > 0 && (
                  <span className="opacity-70">({statusCounts[s.value]})</span>
                )}
              </button>
            ))}
          </div>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                { value: 'all', label: 'Tudo', icon: null, count: total },
                { value: 'food', label: 'Comida', icon: 'utensils-crossed', count: kindCounts.food },
                { value: 'household', label: 'Casa', icon: 'package', count: kindCounts.household },
              ] as { value: DispensaKindFilter; label: string; icon: string | null; count: number }[]
            ).map((c) => (
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
          {showExpiryFilters && (
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {expiryChips.map((c) => {
                const count = c.value === 'todos' ? undefined : expiryCounts[c.value];
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setExpiryFilter(c.value)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      expiryFilter === c.value
                        ? 'bg-brand-500 text-white dark:bg-brand-600'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {c.icon && <Icon name={c.icon} className="h-3.5 w-3.5" />}
                    {c.label} {!!count && <span className="opacity-70">({count})</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="Novo item"
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
      </button>

      {total === 0 ? (
        <div className="mt-12 text-center">
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">Sua dispensa está vazia.</p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-block rounded-full bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            + Adicionar primeiro item
          </button>
        </div>
      ) : list.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nenhum item nesse filtro.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
          {list.map((item) => (
            <DispensaCard
              key={`${item.kind}-${item.data.id}`}
              item={item}
              onOpen={() => openItem(item)}
              onLongPress={() => setActionItemKey(`${item.kind}-${item.data.id}`)}
            />
          ))}
        </ul>
      )}

      {addOpen && (
        <CardActionSheet
          category="Novo item"
          title="O que você quer adicionar?"
          onClose={() => setAddOpen(false)}
          actions={[
            {
              label: 'Ingrediente (comida)',
              icon: <Icon name="utensils-crossed" className="h-4 w-4" />,
              onClick: () => {
                setAddOpen(false);
                navigate('/ingredientes/novo?return=%2Fdispensa&status=dispensa');
              },
            },
            {
              label: 'Item de casa',
              icon: <Icon name="package" className="h-4 w-4" />,
              onClick: () => {
                setAddOpen(false);
                navigate('/dispensa/novo');
              },
            },
          ]}
        />
      )}

      {actionItem && (
        <CardActionSheet
          category="Item"
          title={itemDisplayName(actionItem)}
          onClose={() => setActionItemKey(null)}
          actions={[
            ...DISPENSA_STATUSES.filter((s) => s.value !== itemStatus(actionItem)).map((s) => ({
              label: `Mudar para ${s.label}`,
              icon: <Icon name={s.icon} className="h-4 w-4" />,
              onClick: () => changeStatus(actionItem, s.value),
            })),
            {
              label: 'Duplicar item',
              icon: <Icon name="clipboard" className="h-4 w-4" />,
              onClick: () => duplicateItem(actionItem),
            },
            {
              label: 'Apagar item',
              icon: <TrashIcon className="h-4 w-4" />,
              onClick: () => removeItem(actionItem),
              destructive: true,
            },
          ]}
        />
      )}
    </div>
  );
}

interface DispensaCardProps {
  item: DispensaItem;
  onOpen: () => void;
  onLongPress: () => void;
}

function DispensaCard({ item, onOpen, onLongPress }: DispensaCardProps) {
  const longPress = useLongPress(onLongPress, { delay: 450 });
  const status = itemStatus(item);
  const isDispensa = status === 'dispensa';
  const { expiry_date, no_expiry } = itemExpiry(item);
  const expStatus = expiryStatus(expiry_date, no_expiry);
  const unit = itemUnit(item);
  const quantity = item.data.quantity;
  const subtitle =
    quantity && unit
      ? `${quantity} ${unitLabel(unit)}`
      : quantity != null
        ? String(quantity)
        : '';
  const store = item.data.stores?.[0];
  const statusDef = DISPENSA_STATUSES.find((s) => s.value === status);

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
        className="group flex h-full cursor-pointer select-none flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-colors hover:border-brand-500 [-webkit-touch-callout:none] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-400"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <div className="flex h-full w-full items-center justify-center" aria-hidden>
            {isDispensa ? (
              statusIcon(expStatus) ? (
                <Icon name={statusIcon(expStatus)!} className={`h-10 w-10 ${statusColor(expStatus)}`} />
              ) : (
                <span className={`text-3xl leading-none ${statusColor(expStatus)}`}>—</span>
              )
            ) : (
              <Icon
                name={statusDef?.icon ?? 'package'}
                className="h-10 w-10 text-zinc-300 dark:text-zinc-600"
              />
            )}
          </div>
          {item.kind === 'household' && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-100/95 px-2 py-0.5 text-[10px] font-medium text-amber-700 shadow-sm backdrop-blur-sm dark:bg-amber-900/70 dark:text-amber-200">
              Casa
            </span>
          )}
          {!isDispensa && (
            <span className="absolute right-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-zinc-600 shadow-sm backdrop-blur-sm dark:bg-zinc-900/80 dark:text-zinc-300">
              {statusDef?.label ?? dispensaStatusLabel(status)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-2.5">
          <p className="line-clamp-2 text-sm font-medium leading-tight">{itemDisplayName(item)}</p>
          {(subtitle || store) && (
            <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {subtitle}
              {store && `${subtitle ? ' · ' : ''}${store}`}
            </p>
          )}
          {isDispensa && (
            <p className={`mt-auto pt-1 text-xs font-medium ${statusColor(expStatus)}`}>
              {expiryLabel(expiry_date)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
