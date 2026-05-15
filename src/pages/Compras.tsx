import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  upsertShoppingItem,
  deleteShoppingItem,
  useShoppingItems,
  replaceShoppingList,
} from '../data/shoppingList';
import { upsertPantryItem, usePantryItems } from '../data/pantry';
import { useAllIngredients } from '../data/ingredients';
import { findRecipeById } from '../data/recipes';
import { UNIT_OPTIONS, unitLabel } from '../utils/units';
import type { ShoppingItem } from '../types/shoppingList';
import type { Ingredient } from '../types/ingredient';

const UNGROUPED = '__sem-mercado__';

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function Compras() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const items = useShoppingItems();
  const pantryItems = usePantryItems();
  const allIng = useAllIngredients();
  const returnIngredientId = searchParams.get('ingredient') ?? undefined;
  const [adding, setAdding] = useState(() => Boolean(returnIngredientId));

  const sortedIngredients = useMemo(
    () => [...allIng].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allIng],
  );

  const knownStores = useMemo(() => {
    const all = [...pantryItems, ...items]
      .map((i) => i.store)
      .filter((s): s is string => !!s && s.trim() !== '');
    return [...new Set(all)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [pantryItems, items]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const item of items) {
      const key = item.store ?? UNGROUPED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === UNGROUPED) return 1;
      if (b === UNGROUPED) return -1;
      return a.localeCompare(b, 'pt-BR');
    });
  }, [items]);

  const totalEstimated = items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const totalChecked = items.filter((i) => i.checked).length;

  const toggleChecked = (item: ShoppingItem) => {
    upsertShoppingItem({ ...item, checked: !item.checked });
  };

  const moveCheckedToPantry = () => {
    const checked = items.filter((i) => i.checked);
    if (checked.length === 0) return;
    for (const item of checked) {
      upsertPantryItem({
        id: `pantry-${Date.now()}-${item.id}`,
        ingredient_id: item.ingredient_id,
        raw_text: item.raw_text,
        quantity: item.quantity,
        unit: item.unit,
        expiry_date: item.expiry_date ?? null,
        store: item.store,
        added_at: new Date().toISOString(),
      });
    }
    // Remove checked from shopping list
    replaceShoppingList(items.filter((i) => !i.checked));
  };

  const clearAll = () => {
    if (!confirm('Limpar toda a lista de compras?')) return;
    replaceShoppingList([]);
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-2">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          🛒
        </span>
        <h1 className="text-lg font-semibold">Lista de Compras</h1>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{items.length}</span>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="ml-auto rounded-full bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {adding ? '✕ Fechar' : '+ Adicionar'}
        </button>
      </div>

      {totalEstimated > 0 && (
        <div className="mb-3 rounded-xl bg-zinc-100 px-4 py-2 text-sm dark:bg-zinc-800">
          Total estimado:{' '}
          <span className="font-semibold">
            {totalEstimated.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          {grouped.length > 1 && (
            <span className="ml-2 text-zinc-500 dark:text-zinc-400">· {grouped.length} mercados</span>
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
          <Link
            to="/receitas"
            className="text-sm text-brand-600 hover:underline dark:text-brand-400"
          >
            Adicione itens a partir de uma receita →
          </Link>
        </div>
      ) : (
        <>
          {grouped.map(([store, list]) => (
            <section
              key={store}
              className="mb-4 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {store === UNGROUPED ? '🏪 Sem mercado' : `🏪 ${store}`}
              </h2>
              <ul className="space-y-1">
                {list.map((item) => {
                  const recipe =
                    item.source === 'from_recipe' && item.source_ref
                      ? findRecipeById(item.source_ref)
                      : undefined;
                  return (
                    <li key={item.id} className="flex items-start gap-2 py-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChecked(item);
                        }}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          item.checked
                            ? 'border-brand-500 bg-brand-500 text-white dark:border-brand-400 dark:bg-brand-600'
                            : 'border-zinc-300 dark:border-zinc-600'
                        }`}
                        aria-label={item.checked ? 'Desmarcar' : 'Marcar comprado'}
                      >
                        {item.checked && '✓'}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/compras/${item.id}`)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p
                          className={`text-sm ${
                            item.checked
                              ? 'text-zinc-400 line-through dark:text-zinc-500'
                              : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {item.raw_text}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {item.quantity != null && item.unit && (
                            <span>
                              {item.quantity} {unitLabel(item.unit)}
                            </span>
                          )}
                          {item.price != null && (
                            <span>
                              {item.price.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          )}
                          {item.source === 'from_recipe' && (
                            <span>
                              ← {recipe ? recipe.name : 'receita'}
                            </span>
                          )}
                          {item.source === 'from_pantry' && <span>← vencido na dispensa</span>}
                        </div>
                      </button>
                      <label
                        className="flex shrink-0 cursor-pointer items-center rounded-md px-1.5 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Definir validade"
                      >
                        <input
                          type="date"
                          value={item.expiry_date ?? ''}
                          onChange={(e) =>
                            upsertShoppingItem({
                              ...item,
                              expiry_date: e.target.value || null,
                            })
                          }
                          className="sr-only"
                        />
                        {item.expiry_date ? (
                          <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400">
                            {shortDate(item.expiry_date)}
                          </span>
                        ) : (
                          <span className="text-zinc-400" aria-hidden>
                            📅
                          </span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteShoppingItem(item.id);
                        }}
                        className="shrink-0 px-2 text-zinc-400 hover:text-red-500"
                        aria-label="Remover"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {totalChecked > 0 && (
            <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50 p-3 dark:border-brand-900/40 dark:bg-brand-900/20">
              <p className="mb-2 text-xs font-medium text-brand-800 dark:text-brand-300">
                {totalChecked} item(s) marcado(s) → enviar para a Dispensa
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
  const [selectValue, setSelectValue] = useState(initialIngredientId ?? '');
  const [rawText, setRawText] = useState(
    initIng ? (initIng.brand ? `${initIng.brand} — ${initIng.name}` : initIng.name) : '',
  );
  const [ingredientId, setIngredientId] = useState(initialIngredientId ?? '');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(initIng?.default_unit ?? '');
  const [price, setPrice] = useState('');

  // Store dropdown
  const [storeSelect, setStoreSelect] = useState('');
  const [storeCustom, setStoreCustom] = useState('');

  const handleIngredientSelect = (value: string) => {
    if (value === '__new__') {
      navigate('/ingredientes/novo?return=%2Fcompras');
      return;
    }
    setSelectValue(value);
    if (value === '') {
      setIngredientId('');
    } else {
      const matched = ingredients.find((i) => i.id === value);
      setIngredientId(value);
      if (matched) {
        setRawText(matched.brand ? `${matched.brand} — ${matched.name}` : matched.name);
        if (!unit) setUnit(matched.default_unit);
      }
    }
  };

  const storeSelectDisplayValue =
    storeSelect === '__outro__' || (!knownStores.includes(storeSelect) && storeSelect !== '')
      ? '__outro__'
      : storeSelect;

  useEffect(() => {
    if (storeSelect !== '' && storeSelect !== '__outro__' && !knownStores.includes(storeSelect)) {
      setStoreCustom(storeSelect);
      setStoreSelect('__outro__');
    }
  }, [knownStores]);

  const effectiveRaw = rawText;

  const canAdd = ingredientId !== '';

  const handleAdd = () => {
    if (!canAdd) return;
    const storeValue =
      storeSelect === '__outro__' ? storeCustom.trim() || null : storeSelect || null;
    upsertShoppingItem({
      id: `shopping-${Date.now()}`,
      ingredient_id: ingredientId || null,
      raw_text: effectiveRaw || rawText.trim(),
      quantity: quantity ? Number(quantity) : null,
      unit: unit || null,
      store: storeValue,
      price: price ? Number(price) : null,
      checked: false,
      source: 'manual',
      added_at: new Date().toISOString(),
    });
    setSelectValue('');
    setRawText('');
    setIngredientId('');
    setQuantity('');
    setUnit('');
    setStoreSelect('');
    setStoreCustom('');
    setPrice('');
    onDone();
  };

  const quickAddInputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950';

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Ingrediente (unified) */}
      <div className="mb-2">
        <select
          value={selectValue}
          onChange={(e) => handleIngredientSelect(e.target.value)}
          className={quickAddInputClass}
          autoFocus
        >
          <option value="" disabled>
            Selecione um ingrediente…
          </option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.brand ? `${i.brand} — ${i.name}` : i.name}
            </option>
          ))}
          <option value="__new__">➕ Criar novo ingrediente</option>
        </select>
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
      {/* Store dropdown (Change B) */}
      <div className="mb-2">
        <select
          value={storeSelectDisplayValue}
          onChange={(e) => {
            setStoreSelect(e.target.value);
            if (e.target.value !== '__outro__') setStoreCustom('');
          }}
          className={quickAddInputClass}
        >
          <option value="">— Sem mercado</option>
          {knownStores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="__outro__">➕ Outro...</option>
        </select>
        {storeSelect === '__outro__' && (
          <input
            type="text"
            value={storeCustom}
            onChange={(e) => setStoreCustom(e.target.value)}
            className={`${quickAddInputClass} mt-2`}
            placeholder='Ex.: "Pão de Açúcar"'
            autoFocus
          />
        )}
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
          className="rounded-full bg-zinc-200/60 px-4 py-2 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
