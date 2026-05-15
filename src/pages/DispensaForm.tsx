import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { allIngredients } from '../data/ingredients';
import { getPantryItem, upsertPantryItem, deletePantryItem } from '../data/pantry';
import { UNIT_OPTIONS } from '../utils/units';
import type { PantryItem } from '../types/pantry';

interface FormState {
  raw_text: string;
  ingredient_id: string;
  quantity: string;
  unit: string;
  expiry_date: string;
  store: string;
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
      store: '',
      notes: '',
    };
  }
  return {
    raw_text: item.raw_text,
    ingredient_id: item.ingredient_id ?? '',
    quantity: item.quantity?.toString() ?? '',
    unit: item.unit ?? '',
    expiry_date: item.expiry_date ?? '',
    store: item.store ?? '',
    notes: item.notes ?? '',
  };
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

  const [state, setState] = useState<FormState>(() => itemToForm(original));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!state.raw_text.trim() && !state.ingredient_id) {
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
    const item: PantryItem = {
      id: original?.id ?? `pantry-${Date.now()}`,
      ingredient_id: state.ingredient_id || null,
      raw_text: rawText,
      quantity: state.quantity ? Number(state.quantity) : null,
      unit: state.unit || null,
      expiry_date: state.expiry_date || null,
      store: state.store.trim() || null,
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

      <Field label="Item">
        <input
          type="text"
          value={state.raw_text}
          onChange={(e) => setState((s) => ({ ...s, raw_text: e.target.value }))}
          required
          className={inputClass}
          placeholder='Ex.: "Leite integral 1L"'
        />
      </Field>

      <Field label="Vincular a ingrediente (opcional)">
        <select
          value={state.ingredient_id}
          onChange={(e) => {
            const matched = sortedIngredients.find((i) => i.id === e.target.value);
            setState((s) => {
              const autoName = matched
                ? matched.brand
                  ? `${matched.brand} — ${matched.name}`
                  : matched.name
                : s.raw_text;
              return {
                ...s,
                ingredient_id: e.target.value,
                raw_text: autoName,
                unit: matched && !s.unit ? matched.default_unit : s.unit,
              };
            });
          }}
          className={inputClass}
        >
          <option value="">🔗 Sem vínculo</option>
          {sortedIngredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.brand ? `${i.brand} — ${i.name}` : i.name}
            </option>
          ))}
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

      <Field label="Data de validade">
        <input
          type="date"
          value={state.expiry_date}
          onChange={(e) => setState((s) => ({ ...s, expiry_date: e.target.value }))}
          className={inputClass}
        />
      </Field>

      <Field label="Mercado / loja (opcional)">
        <input
          type="text"
          value={state.store}
          onChange={(e) => setState((s) => ({ ...s, store: e.target.value }))}
          className={inputClass}
          placeholder='Ex.: "Pão de Açúcar"'
        />
      </Field>

      <Field label="Notas (opcional)">
        <textarea
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
          rows={2}
          className={inputClass}
        />
      </Field>
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
