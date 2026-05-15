import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { allIngredients, findIngredientById } from '../data/ingredients';
import { getPantryItem, upsertPantryItem, deletePantryItem, usePantryItems } from '../data/pantry';
import { useShoppingItems } from '../data/shoppingList';
import { UNIT_OPTIONS } from '../utils/units';
import NutritionTable from '../components/NutritionTable';
import type { PantryItem } from '../types/pantry';

interface FormState {
  raw_text: string;
  ingredient_id: string;
  quantity: string;
  unit: string;
  expiry_date: string;
  notes: string;
}

function itemToForm(item: PantryItem | undefined): FormState {
  if (!item) {
    return {
      raw_text: '',
      ingredient_id: '',
      quantity: '',
      unit: '',
      expiry_date: '',
      notes: '',
    };
  }
  return {
    raw_text: item.raw_text,
    ingredient_id: item.ingredient_id ?? '',
    quantity: item.quantity?.toString() ?? '',
    unit: item.unit ?? '',
    expiry_date: item.expiry_date ?? '',
    notes: item.notes ?? '',
  };
}

function initialSelectValue(state: FormState): string {
  if (state.ingredient_id) return state.ingredient_id;
  if (state.raw_text) return '__custom__';
  return '';
}

export default function DispensaForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editing = id !== undefined;
  const original = editing ? getPantryItem(id) : undefined;

  if (editing && !original) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Item não encontrado na dispensa.</p>
        <Link to="/dispensa" className="text-brand-600 underline dark:text-brand-400">
          Voltar
        </Link>
      </div>
    );
  }

  const sortedIngredients = useMemo(
    () => [...allIngredients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [],
  );

  const pantryItems = usePantryItems();
  const shoppingItems = useShoppingItems();
  const knownStores = useMemo(() => {
    const all = [...pantryItems, ...shoppingItems]
      .map((i) => i.store)
      .filter((s): s is string => !!s && s.trim() !== '');
    return [...new Set(all)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [pantryItems, shoppingItems]);

  const initialState = itemToForm(original);
  const [state, setState] = useState<FormState>(() => initialState);
  const [selectValue, setSelectValue] = useState(() => initialSelectValue(initialState));
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

  const handleIngredientSelect = (value: string) => {
    setSelectValue(value);
    if (value === '__custom__' || value === '') {
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
    if (selectValue === '' || (selectValue === '__custom__' && !state.raw_text.trim())) {
      setError('Informe o nome do item ou selecione um ingrediente');
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
    const item: PantryItem = {
      id: original?.id ?? `pantry-${Date.now()}`,
      ingredient_id: state.ingredient_id || null,
      raw_text: rawText,
      quantity: state.quantity ? Number(state.quantity) : null,
      unit: state.unit || null,
      expiry_date: state.expiry_date || null,
      store: storeValue,
      added_at: original?.added_at ?? new Date().toISOString(),
      notes: state.notes.trim() || undefined,
    };
    upsertPantryItem(item);
    navigate('/dispensa');
  };

  const handleDelete = () => {
    if (!original) return;
    if (!confirm(`Remover "${original.raw_text}" da dispensa?`)) return;
    deletePantryItem(original.id);
    navigate('/dispensa');
  };

  const selectDisplayValue =
    storeSelect === '__outro__' || (!knownStores.includes(storeSelect) && storeSelect !== '')
      ? '__outro__'
      : storeSelect;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md px-4 pb-6">
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
        <Link
          to="/dispensa"
          className="rounded-full bg-zinc-200/60 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
        >
          ✕
        </Link>
        <h1 className="flex-1 truncate text-lg font-semibold">
          {editing ? 'Editar item' : 'Novo item'}
        </h1>
        {editing && (
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
            Selecione ou escolha personalizado…
          </option>
          <option value="__custom__">✏️ Nome personalizado</option>
          {sortedIngredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.brand ? `${i.brand} — ${i.name}` : i.name}
            </option>
          ))}
        </select>
        {selectValue === '__custom__' && (
          <input
            type="text"
            value={state.raw_text}
            onChange={(e) => setState((s) => ({ ...s, raw_text: e.target.value }))}
            className={`${inputClass} mt-2`}
            placeholder='Ex.: "1 galho de alecrim"'
            autoFocus
          />
        )}
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

      <Field label="Data de validade">
        <input
          type="date"
          value={state.expiry_date}
          onChange={(e) => setState((s) => ({ ...s, expiry_date: e.target.value }))}
          className={inputClass}
        />
      </Field>

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

      <Field label="Notas (opcional)">
        <textarea
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
          rows={2}
          className={inputClass}
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
