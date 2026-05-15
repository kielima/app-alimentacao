import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  upsertShoppingItem,
  deleteShoppingItem,
  useShoppingItems,
  replaceShoppingList,
} from '../data/shoppingList';
import { upsertPantryItem } from '../data/pantry';
import { allIngredients, findIngredientById } from '../data/ingredients';
import { findRecipeById } from '../data/recipes';
import { UNIT_OPTIONS, unitLabel } from '../utils/units';
import type { ShoppingItem } from '../types/shoppingList';
import type { Ingredient } from '../types/ingredient';

const UNGROUPED = '__sem-mercado__';

export default function Compras() {
  const items = useShoppingItems();
  const [adding, setAdding] = useState(false);
  const [moveValidity, setMoveValidity] = useState('');

  const sortedIngredients = useMemo(
    () => [...allIngredients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [],
  );

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
        expiry_date: moveValidity || null,
        store: item.store,
        added_at: new Date().toISOString(),
      });
    }
    // Remove checked from shopping list
    replaceShoppingList(items.filter((i) => !i.checked));
    setMoveValidity('');
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

      {adding && <QuickAdd onDone={() => setAdding(false)} ingredients={sortedIngredients} />}

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
                  const ing = item.ingredient_id ? findIngredientById(item.ingredient_id) : undefined;
                  const recipe =
                    item.source === 'from_recipe' && item.source_ref
                      ? findRecipeById(item.source_ref)
                      : undefined;
                  return (
                    <li key={item.id} className="flex items-start gap-2 py-1">
                      <button
                        type="button"
                        onClick={() => toggleChecked(item)}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          item.checked
                            ? 'border-brand-500 bg-brand-500 text-white dark:border-brand-400 dark:bg-brand-600'
                            : 'border-zinc-300 dark:border-zinc-600'
                        }`}
                        aria-label={item.checked ? 'Desmarcar' : 'Marcar comprado'}
                      >
                        {item.checked && '✓'}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${
                            item.checked
                              ? 'text-zinc-400 line-through dark:text-zinc-500'
                              : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {ing ? (
                            <Link
                              to={`/ingredientes/${ing.id}`}
                              className="hover:text-brand-600 dark:hover:text-brand-400"
                            >
                              {item.raw_text}
                            </Link>
                          ) : (
                            item.raw_text
                          )}
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
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteShoppingItem(item.id)}
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
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-brand-800 dark:text-brand-300">
                  Validade:
                  <input
                    type="date"
                    value={moveValidity}
                    onChange={(e) => setMoveValidity(e.target.value)}
                    className="rounded-md border border-brand-300 bg-white px-2 py-1 text-xs dark:border-brand-700 dark:bg-zinc-900"
                  />
                </label>
                <button
                  type="button"
                  onClick={moveCheckedToPantry}
                  className="rounded-full bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600"
                >
                  Mover para Dispensa
                </button>
              </div>
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

function QuickAdd({ onDone, ingredients }: { onDone: () => void; ingredients: Ingredient[] }) {
  const [raw, setRaw] = useState('');
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [store, setStore] = useState('');
  const [price, setPrice] = useState('');

  const handleAdd = () => {
    if (!raw.trim()) return;
    upsertShoppingItem({
      id: `shopping-${Date.now()}`,
      ingredient_id: ingredientId || null,
      raw_text: raw.trim(),
      quantity: quantity ? Number(quantity) : null,
      unit: unit || null,
      store: store.trim() || null,
      price: price ? Number(price) : null,
      checked: false,
      source: 'manual',
      added_at: new Date().toISOString(),
    });
    setRaw('');
    setIngredientId('');
    setQuantity('');
    setUnit('');
    setPrice('');
    onDone();
  };

  return (
    <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <input
        type="text"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder='Ex.: "1 maço de couve"'
        className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
        autoFocus
      />
      <select
        value={ingredientId}
        onChange={(e) => {
          const matched = ingredients.find((i) => i.id === e.target.value);
          setIngredientId(e.target.value);
          if (matched && !unit) setUnit(matched.default_unit);
        }}
        className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
      >
        <option value="">🔗 Sem vínculo</option>
        {ingredients.map((i) => (
          <option key={i.id} value={i.id}>
            {i.brand ? `${i.brand} — ${i.name}` : i.name}
          </option>
        ))}
      </select>
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
      <div className="mb-2 grid grid-cols-2 gap-2">
        <input
          type="text"
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder="Mercado"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Preço R$"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!raw.trim()}
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
