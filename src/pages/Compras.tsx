import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import SearchableSelect from '../components/SearchableSelect';
import ScanButton from '../components/ScanButton';
import FilterButton from '../components/FilterButton';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import TrashIcon from '../components/TrashIcon';
import Icon from '../components/Icon';
import { useAllIngredients } from '../data/ingredients';
import { upsertUserIngredient } from '../data/userIngredients';
import { useHouseholdItems, upsertHouseholdItem } from '../data/householdItems';
import { useMarkets } from '../data/markets';
import { handleScanForShoppingList } from '../lib/scanActions';
import { UNIT_OPTIONS, unitLabel } from '../utils/units';
import { createUIStore } from '../utils/persistentUIState';
import { itemDisplayName, itemKindOf, itemUnit, type DispensaItem } from '../hooks/useDispensa';
import type { Ingredient } from '../types/ingredient';

const UNGROUPED = '__sem-mercado__';
const ALL_STORES = '__todos__';

type KindFilter = 'all' | 'food' | 'household';

const ui = createUIStore({
  storeFilter: ALL_STORES as string,
  kindFilter: 'all' as KindFilter,
  showFilters: false,
});

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function Compras() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const allIngredients = useAllIngredients();
  const householdItems = useHouseholdItems();
  const markets = useMarkets();
  const returnIngredientId = searchParams.get('ingredient') ?? undefined;
  const [adding, setAdding] = useState(() => Boolean(returnIngredientId));
  const [scanOpen, setScanOpen] = useState(false);
  const { storeFilter, kindFilter, showFilters } = ui.useStore();
  const setStoreFilter = (s: string) => ui.set('storeFilter', s);
  const setKindFilter = (k: KindFilter) => ui.set('kindFilter', k);
  const setShowFilters = (s: boolean | ((prev: boolean) => boolean)) =>
    ui.set('showFilters', s);

  const items = useMemo<DispensaItem[]>(
    () => [
      ...allIngredients
        .filter((i) => i.status === 'comprar')
        .map((data): DispensaItem => ({ kind: 'ingredient', data })),
      ...householdItems
        .filter((i) => i.status === 'comprar')
        .map((data): DispensaItem => ({ kind: 'household', data })),
    ],
    [allIngredients, householdItems],
  );

  const sortedIngredients = useMemo(
    () => [...allIngredients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allIngredients],
  );

  const knownStores = useMemo(() => {
    const fromItems = [...allIngredients, ...householdItems].flatMap((i) => i.stores ?? []);
    const fromMarkets = markets.map((m) => m.name);
    return [...new Set([...fromMarkets, ...fromItems])].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }, [allIngredients, householdItems, markets]);

  const kindCounts = useMemo(() => {
    let food = 0;
    let household = 0;
    for (const item of items) {
      if (itemKindOf(item) === 'household') household++;
      else food++;
    }
    return { food, household };
  }, [items]);

  const kindFilteredItems = useMemo(() => {
    if (kindFilter === 'all') return items;
    return items.filter((i) => itemKindOf(i) === kindFilter);
  }, [items, kindFilter]);

  // Um item pode pertencer a vários mercados ao mesmo tempo, então ele conta
  // em cada grupo/mercado em que foi marcado (para os chips de filtro).
  const allGrouped = useMemo(() => {
    const map = new Map<string, DispensaItem[]>();
    for (const item of kindFilteredItems) {
      const stores = item.data.stores ?? [];
      const keys = stores.length > 0 ? stores : [UNGROUPED];
      for (const key of keys) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === UNGROUPED) return 1;
      if (b === UNGROUPED) return -1;
      return a.localeCompare(b, 'pt-BR');
    });
  }, [kindFilteredItems]);

  const storeOptions = useMemo(
    () => allGrouped.map(([store, list]) => ({ value: store, count: list.length })),
    [allGrouped],
  );

  // Com o filtro "Todos" cada item aparece uma única vez; com um mercado
  // específico selecionado, mostra os itens marcados para aquele mercado.
  const filteredItems = useMemo(() => {
    if (storeFilter === ALL_STORES) return kindFilteredItems;
    return allGrouped.find(([store]) => store === storeFilter)?.[1] ?? [];
  }, [storeFilter, allGrouped, kindFilteredItems]);

  const distinctStoreCount = useMemo(() => {
    const set = new Set<string>();
    for (const item of filteredItems) {
      const stores = item.data.stores ?? [];
      if (stores.length === 0) set.add(UNGROUPED);
      else stores.forEach((s) => set.add(s));
    }
    return set.size;
  }, [filteredItems]);

  const hasActiveFilters = storeFilter !== ALL_STORES || kindFilter !== 'all';
  const isFiltering = hasActiveFilters;

  const totalEstimated = filteredItems.reduce((sum, i) => sum + (i.data.price ?? 0), 0);
  const totalChecked = filteredItems.filter((i) => i.data.checked).length;

  const toggleChecked = (item: DispensaItem) => {
    if (item.kind === 'ingredient') {
      upsertUserIngredient({ ...item.data, checked: !item.data.checked });
    } else {
      upsertHouseholdItem({ ...item.data, checked: !item.data.checked });
    }
  };

  const setItemExpiry = (item: DispensaItem, expiry: string | null) => {
    if (item.kind === 'ingredient') upsertUserIngredient({ ...item.data, expiry_date: expiry });
    else upsertHouseholdItem({ ...item.data, expiry_date: expiry });
  };

  const removeFromList = (item: DispensaItem) => {
    if (item.kind === 'ingredient') {
      upsertUserIngredient({ ...item.data, status: 'backlog', checked: false });
    } else {
      upsertHouseholdItem({ ...item.data, status: 'backlog', checked: false });
    }
  };

  const openItem = (item: DispensaItem) => {
    if (item.kind === 'ingredient') navigate(`/ingredientes/${item.data.id}/editar`);
    else navigate(`/dispensa/${item.data.id}/editar`);
  };

  const moveCheckedToPantry = () => {
    const checked = items.filter((i) => i.data.checked);
    if (checked.length === 0) return;
    for (const item of checked) {
      if (item.kind === 'ingredient') {
        upsertUserIngredient({ ...item.data, status: 'dispensa', checked: false });
      } else {
        upsertHouseholdItem({ ...item.data, status: 'dispensa', checked: false });
      }
    }
  };

  const clearAll = () => {
    if (!confirm('Limpar toda a lista de compras?')) return;
    for (const item of items) {
      if (item.kind === 'ingredient') {
        upsertUserIngredient({ ...item.data, status: 'backlog', checked: false });
      } else {
        upsertHouseholdItem({ ...item.data, status: 'backlog', checked: false });
      }
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-2 pb-28">
      <HeaderSlot>
        <div className="flex-1" />
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
        actions={['add-shopping', 'manual-not-found']}
        enableNfce
        comprarItems={items}
        onPick={(result, action) => {
          setScanOpen(false);
          handleScanForShoppingList(result, action, allIngredients, navigate);
        }}
      />

      {showFilters && (
        <div className="sticky top-0 z-10 -mx-4 mb-3 space-y-1.5 bg-zinc-50/95 px-4 pb-2 pt-2 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/80">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                { value: 'all', label: 'Tudo', icon: null, count: items.length },
                { value: 'food', label: 'Comida', icon: 'utensils-crossed', count: kindCounts.food },
                { value: 'household', label: 'Casa', icon: 'package', count: kindCounts.household },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setKindFilter(opt.value)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  kindFilter === opt.value
                    ? 'bg-brand-500 text-white dark:bg-brand-600'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {opt.icon && <Icon name={opt.icon} className="h-3.5 w-3.5" />}
                {opt.label} {opt.count > 0 && <span className="opacity-70">({opt.count})</span>}
              </button>
            ))}
          </div>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setStoreFilter(ALL_STORES)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                storeFilter === ALL_STORES
                  ? 'bg-brand-500 text-white dark:bg-brand-600'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              Todos {kindFilteredItems.length > 0 && <span className="opacity-70">({kindFilteredItems.length})</span>}
            </button>
            {storeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStoreFilter(opt.value)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  storeFilter === opt.value
                    ? 'bg-brand-500 text-white dark:bg-brand-600'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <Icon name="store" className="h-3.5 w-3.5" />
                {opt.value === UNGROUPED ? 'Sem mercado' : opt.value}{' '}
                <span className="opacity-70">({opt.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isFiltering && items.length > 0 && (
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          {filteredItems.length} de {items.length} item{items.length !== 1 ? 's' : ''}
        </p>
      )}

      <button
        type="button"
        onClick={() => setAdding((a) => !a)}
        aria-label={adding ? 'Fechar' : 'Adicionar item'}
        className={`fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition-colors ${
          adding
            ? 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
            : 'bg-brand-cream text-brand-700 hover:bg-brand-100 dark:bg-brand-cream dark:text-brand-700 dark:hover:bg-brand-100'
        }`}
      >
        {adding ? (
          <Icon name="x" className="h-7 w-7" />
        ) : (
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
        )}
      </button>

      {totalEstimated > 0 && (
        <div className="mb-3 rounded-xl bg-zinc-100 px-4 py-2 text-sm dark:bg-zinc-800">
          Total estimado:{' '}
          <span className="font-semibold">
            {totalEstimated.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          {distinctStoreCount > 1 && (
            <span className="ml-2 text-zinc-500 dark:text-zinc-400">· {distinctStoreCount} mercados</span>
          )}
        </div>
      )}

      {adding && (
        <QuickAdd
          onDone={() => setAdding(false)}
          ingredients={sortedIngredients}
          knownStores={knownStores}
          initialIngredientId={returnIngredientId}
        />
      )}

      {items.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Sua lista de compras está vazia.
          </p>
          <button
            type="button"
            onClick={() => navigate('/receitas')}
            className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400"
          >
            Adicione itens a partir de uma receita{' '}
            <Icon name="arrow-right" className="h-4 w-4" />
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nenhum item nesse filtro.
        </p>
      ) : (
        <>
          <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <ul className="space-y-1">
              {filteredItems.map((item) => (
                <li key={`${item.kind}-${item.data.id}`} className="flex items-start gap-2 py-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleChecked(item);
                    }}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      item.data.checked
                        ? 'border-brand-500 bg-brand-500 text-white dark:border-brand-400 dark:bg-brand-600'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                    aria-label={item.data.checked ? 'Desmarcar' : 'Marcar comprado'}
                  >
                    {item.data.checked && <Icon name="check" className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className={`text-sm ${
                        item.data.checked
                          ? 'text-zinc-400 line-through dark:text-zinc-500'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      {itemDisplayName(item)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {itemKindOf(item) === 'household' && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Icon name="package" className="h-3.5 w-3.5" /> Casa
                        </span>
                      )}
                      {item.data.quantity != null && itemUnit(item) && (
                        <span>
                          {item.data.quantity} {unitLabel(itemUnit(item))}
                        </span>
                      )}
                      {item.data.price != null && (
                        <span>
                          {item.data.price.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      )}
                    </div>
                  </button>
                  <label
                    className="flex h-5 shrink-0 cursor-pointer items-center rounded-md px-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Definir validade"
                  >
                    <input
                      type="date"
                      value={item.data.expiry_date ?? ''}
                      onChange={(e) => setItemExpiry(item, e.target.value || null)}
                      className="sr-only"
                    />
                    {item.data.expiry_date ? (
                      <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400">
                        {shortDate(item.data.expiry_date)}
                      </span>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 text-zinc-400"
                        aria-hidden
                      >
                        <path d="M8 2v4M16 2v4M3 10h18M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9" />
                        <path d="m16 20 2 2 4-4" />
                      </svg>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromList(item);
                    }}
                    className="flex h-5 shrink-0 items-center px-2 text-red-500 hover:text-red-700"
                    aria-label="Remover"
                    title="Remover da lista de compras (volta pra backlog)"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {totalChecked > 0 && (
            <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50 p-3 dark:border-brand-900/40 dark:bg-brand-900/20">
              <p className="mb-2 text-xs font-medium text-brand-800 dark:text-brand-300">
                <span className="inline-flex items-center gap-1">
                  {totalChecked} item(s) marcado(s) <Icon name="arrow-right" className="h-3.5 w-3.5" /> enviar para a Dispensa
                </span>
              </p>
              <button
                type="button"
                onClick={moveCheckedToPantry}
                className="rounded-full bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600"
              >
                Mover para Dispensa
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={clearAll}
            className="mt-2 w-full rounded-xl border border-zinc-200 py-2 text-xs text-zinc-500 hover:border-red-300 hover:text-red-600 dark:border-zinc-800 dark:text-zinc-400"
          >
            Limpar lista inteira
          </button>
        </>
      )}
    </div>
  );
}

function QuickAdd({
  onDone,
  ingredients,
  knownStores,
  initialIngredientId,
}: {
  onDone: () => void;
  ingredients: Ingredient[];
  knownStores: string[];
  initialIngredientId?: string;
}) {
  const navigate = useNavigate();

  const getInitialIngredient = () => {
    if (!initialIngredientId) return null;
    return ingredients.find((i) => i.id === initialIngredientId) ?? null;
  };

  const initIng = getInitialIngredient();
  const [mode, setMode] = useState<'food' | 'household'>('food');
  const [selectValue, setSelectValue] = useState(initialIngredientId ?? '');
  const [rawText, setRawText] = useState('');
  const [ingredientId, setIngredientId] = useState(initialIngredientId ?? '');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(initIng?.default_unit ?? '');
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');

  const handleIngredientSelect = (value: string) => {
    setSelectValue(value);
    if (value === '') {
      setIngredientId('');
    } else {
      const matched = ingredients.find((i) => i.id === value);
      setIngredientId(value);
      if (matched && !unit) setUnit(matched.default_unit);
    }
  };

  const canAdd = mode === 'household' ? rawText.trim() !== '' : ingredientId !== '';

  const handleAdd = () => {
    if (!canAdd) return;
    if (mode === 'household') {
      upsertHouseholdItem({
        id: `household-${Date.now()}`,
        raw_text: rawText.trim(),
        quantity: quantity ? Number(quantity) : null,
        unit: unit || null,
        expiry_date: null,
        stores: store ? [store] : [],
        price: price ? Number(price) : null,
        checked: false,
        status: 'comprar',
        added_at: new Date().toISOString(),
        kind: 'household',
      });
    } else {
      const matched = ingredients.find((i) => i.id === ingredientId);
      if (!matched) return;
      upsertUserIngredient({
        ...matched,
        status: 'comprar',
        quantity: quantity ? Number(quantity) : null,
        stock_unit: unit || null,
        stores: store ? [store] : [],
        price: price ? Number(price) : null,
        checked: false,
      });
    }
    setSelectValue('');
    setRawText('');
    setIngredientId('');
    setQuantity('');
    setUnit('');
    setStore('');
    setPrice('');
    onDone();
  };

  const quickAddInputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950';

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        {(
          [
            { value: 'food', label: 'Comida', icon: 'utensils-crossed' },
            { value: 'household', label: 'Item de casa', icon: 'package' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setMode(opt.value)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === opt.value
                ? 'bg-brand-500 text-white dark:bg-brand-600'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Icon name={opt.icon} className="h-4 w-4" />
            {opt.label}
          </button>
        ))}
      </div>
      <div className="mb-2">
        {mode === 'household' ? (
          <input
            type="text"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Ex.: Papel higiênico, sabonete, caneta…"
            className={quickAddInputClass}
            autoFocus
          />
        ) : (
          <SearchableSelect
            value={selectValue}
            onChange={handleIngredientSelect}
            options={ingredients.map((i) => ({
              value: i.id,
              label: i.brand ? `${i.brand} — ${i.name}` : i.name,
            }))}
            placeholder="Selecione um ingrediente…"
            createLabel="Criar novo ingrediente"
            onCreate={(q) => {
              const params = new URLSearchParams();
              params.set('return', '/compras');
              params.set('status', 'comprar');
              const trimmed = q?.trim();
              if (trimmed) params.set('name', trimmed);
              navigate(`/ingredientes/novo?${params.toString()}`);
            }}
            className="text-sm"
          />
        )}
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qtd"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-2">
        <SearchableSelect
          value={store}
          onChange={setStore}
          options={knownStores.map((s) => ({ value: s, label: s }))}
          placeholder="— Sem mercado"
          createLabel="Outro mercado…"
          onCreate={(q) => {
            if (q?.trim()) setStore(q.trim());
          }}
          className="text-sm"
        />
      </div>
      <div className="mb-2">
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Preço R$"
          className={quickAddInputClass}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="flex-1 rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Adicionar
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-full bg-zinc-100 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
