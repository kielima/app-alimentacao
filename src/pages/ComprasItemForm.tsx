import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAllIngredients, getAllIngredients, findIngredientById } from '../data/ingredients';
import { getShoppingItem, upsertShoppingItem, deleteShoppingItem, useShoppingItems } from '../data/shoppingList';
import { usePantryItems } from '../data/pantry';
import { UNIT_OPTIONS } from '../utils/units';
import NutritionTable from '../components/NutritionTable';
import type { ShoppingItem } from '../types/shoppingList';

interface FormState {
  raw_text: string;
  ingredient_id: string;
  quantity: string;
  unit: string;
  price: string;
}

function itemToForm(item: ShoppingItem | undefined): FormState {
  if (!item) {
    return {
      raw_text: '',
      ingredient_id: '',
      quantity: '',
      unit: '',
      price: '',
    };
  }
  return {
    raw_text: item.raw_text,
    ingredient_id: item.ingredient_id ?? '',
    quantity: item.quantity?.toString() ?? '',
    unit: item.unit ?? '',
    price: item.price?.toString() ?? '',
  };
}

export default function ComprasItemForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const original = id !== undefined ? getShoppingItem(id) : undefined;

  // Hooks must be called before early return
  const returnIngredientId = searchParams.get('ingredient');
  const allIng = useAllIngredients();
  const sortedIngredients = useMemo(
    () => [...allIng].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allIng],
  );

  const pantryItems = usePantryItems();
  const shoppingItems = useShoppingItems();
  const knownStores = useMemo(() => {
    const all = [...pantryItems, ...shoppingItems]
      .map((i) => i.store)
      .filter((s): s is string => !!s && s.trim() !== '');
    return [...new Set(all)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [pantryItems, shoppingItems]);

  const [state, setState] = useState<FormState>(() => {
    const base = itemToForm(original);
    if (returnIngredientId) {
      const ing = getAllIngredients().find((i) => i.id === returnIngredientId);
      return {
        ...base,
        ingredient_id: returnIngredientId,
        raw_text: ing ? (ing.brand ? `${ing.brand} — ${ing.name}` : ing.name) : base.raw_text,
        unit: base.unit || (ing?.default_unit ?? ''),
      };
    }
    return base;
  });

  const [selectValue, setSelectValue] = useState<string>(() => {
    if (returnIngredientId) return returnIngredientId;
    return original?.ingredient_id ?? '';
  });

  const [error, setError] = useState<string | null>(null);

  // Store state
  const [storeSelect, setStoreSelect] = useState<string>(() => original?.store ?? '');
  const [storeCustom, setStoreCustom] = useState('');

  useEffect(() => {
    if (storeSelect !== '' && storeSelect !== '__outro__' && !knownStores.includes(storeSelect)) {
      setStoreCustom(storeSelect);
      setStoreSelect('__outro__');
    }
  }, [knownStores]); // intentionally only runs when knownStores changes (first load)

  if (id !== undefined && !original) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Item não encontrado.</p>
        <Link to="/compras" className="text-brand-600 underline dark:text-brand-400">
          Voltar
        </Link>
      </div>
    );
  }

  const returnPath = `/compras/${id}`;

  const handleIngredientSelect = (value: string) => {
    if (value === '__new__') {
      navigate(`/ingredientes/novo?return=${encodeURIComponent(returnPath)}`);
      return;
    }
    setSelectValue(value);
    if (value === '') {
      setState((s) => ({ ...s, ingredient_id: '', unit: s.unit }));
    } else {
      const matched = sortedIngredients.find((i) => i.id === value);
      setState((s) => ({
        ...s,
        ingredient_id: value,
        raw_text: matched
          ? matched.brand
            ? `${matched.brand} — ${matched.name}`
            : matched.name
          : s.raw_text,
        unit: matched && !s.unit ? matched.default_unit : s.unit,
      }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!state.ingredient_id) {
      setError('Selecione um ingrediente');
      return;
    }
    const linkedIngredient = sortedIngredients.find((i) => i.id === state.ingredient_id);
    const rawText =
      state.raw_text.trim() ||
      (linkedIngredient
        ? linkedIngredient.brand
          ? `${linkedIngredient.brand} — ${linkedIngredient.name}`
          : linkedIngredient.name
        : '');
    const storeValue =
      storeSelect === '__outro__' ? storeCustom.trim() || null : storeSelect || null;
    const item: ShoppingItem = {
      id: original?.id ?? `shopping-${Date.now()}`,
      ingredient_id: state.ingredient_id || null,
      raw_text: rawText,
      quantity: state.quantity ? Number(state.quantity) : null,
      unit: state.unit || null,
      store: storeValue,
      price: state.price ? Number(state.price) : null,
      checked: original?.checked ?? false,
      source: original?.source ?? 'manual',
      source_ref: original?.source_ref,
      added_at: original?.added_at ?? new Date().toISOString(),
    };
    upsertShoppingItem(item);
    navigate('/compras');
  };

  const handleDelete = () => {
    if (!original) return;
    if (!confirm(`Remover "${original.raw_text}" da lista de compras?`)) return;
    deleteShoppingItem(original.id);
    navigate('/compras');
  };

  const selectDisplayValue =
    storeSelect === '__outro__' || (!knownStores.includes(storeSelect) && storeSelect !== '')
      ? '__outro__'
      : storeSelect;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md px-4 pb-6">
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
        <Link
          to="/compras"
          className="rounded-full bg-zinc-200/60 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
        >
          ✕
        </Link>
        <h1 className="flex-1 truncate text-lg font-semibold">Editar item</h1>
        {original && (
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-full bg-zinc-200/60 px-3 py-1.5 text-sm text-zinc-700 hover:bg-red-100 hover:text-red-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-red-900/30 dark:hover:text-red-300"
            aria-label="Excluir"
          >
            🗑️
          </button>
        )}
        <button
          type="submit"
          className="rounded-full bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Salvar
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <Field label="Ingrediente">
        <select
          value={selectValue}
          onChange={(e) => handleIngredientSelect(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Selecione um ingrediente…
          </option>
          {sortedIngredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.brand ? `${i.brand} — ${i.name}` : i.name}
            </option>
          ))}
          <option value="__new__">➕ Criar novo ingrediente</option>
        </select>
      </Field>

      <div className="grid grid-cols-[100px,1fr] gap-3">
        <Field label="Quantidade">
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={state.quantity}
            onChange={(e) => setState((s) => ({ ...s, quantity: e.target.value }))}
            className={inputClass}
            placeholder="—"
          />
        </Field>
        <Field label="Unidade">
          <select
            value={state.unit}
            onChange={(e) => setState((s) => ({ ...s, unit: e.target.value }))}
            className={inputClass}
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Mercado / loja (opcional)">
        <select
          value={selectDisplayValue}
          onChange={(e) => {
            setStoreSelect(e.target.value);
            if (e.target.value !== '__outro__') setStoreCustom('');
          }}
          className={inputClass}
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
            onChange={(e) => {
              setStoreCustom(e.target.value);
            }}
            className={`${inputClass} mt-2`}
            placeholder='Ex.: "Pão de Açúcar"'
            autoFocus
          />
        )}
      </Field>

      <Field label="Preço (opcional)">
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={state.price}
          onChange={(e) => setState((s) => ({ ...s, price: e.target.value }))}
          className={inputClass}
          placeholder="R$ —"
        />
      </Field>

      {state.ingredient_id && (() => {
        const ing = findIngredientById(state.ingredient_id);
        return ing ? (
          <section className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Tabela Nutricional
            </h2>
            <NutritionTable ingredient={ing} />
          </section>
        ) : null;
      })()}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900';
