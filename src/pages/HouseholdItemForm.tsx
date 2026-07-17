import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import TrashIcon from '../components/TrashIcon';
import Icon from '../components/Icon';
import {
  getHouseholdItem,
  upsertHouseholdItem,
  deleteHouseholdItem,
  useHouseholdItems,
} from '../data/householdItems';
import { useAllIngredients } from '../data/ingredients';
import { useMarkets } from '../data/markets';
import { UNIT_OPTIONS } from '../utils/units';
import { DISPENSA_STATUSES, type DispensaStatus } from '../types/dispensaStatus';
import type { HouseholdItem } from '../types/household';

interface FormState {
  raw_text: string;
  status: DispensaStatus;
  quantity: string;
  unit: string;
  expiry_date: string;
  no_expiry: boolean;
  price: string;
  notes: string;
}

function itemToForm(item: HouseholdItem | undefined): FormState {
  if (!item) {
    return {
      raw_text: '',
      status: 'dispensa',
      quantity: '',
      unit: '',
      expiry_date: '',
      no_expiry: false,
      price: '',
      notes: '',
    };
  }
  return {
    raw_text: item.raw_text,
    status: item.status,
    quantity: item.quantity?.toString() ?? '',
    unit: item.unit ?? '',
    expiry_date: item.expiry_date ?? '',
    no_expiry: item.no_expiry ?? false,
    price: item.price?.toString() ?? '',
    notes: item.notes ?? '',
  };
}

export default function HouseholdItemForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editing = id !== undefined;
  const original = editing ? getHouseholdItem(id) : undefined;

  const householdItems = useHouseholdItems();
  const allIngredients = useAllIngredients();
  const markets = useMarkets();

  const knownStores = useMemo(() => {
    const fromItems = [
      ...householdItems.flatMap((i) => i.stores ?? []),
      ...allIngredients.flatMap((i) => i.stores ?? []),
    ];
    const fromMarkets = markets.map((m) => m.name);
    return [...new Set([...fromMarkets, ...fromItems])].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }, [householdItems, allIngredients, markets]);

  const [state, setState] = useState<FormState>(() => itemToForm(original));
  const [error, setError] = useState<string | null>(null);
  const [selectedStores, setSelectedStores] = useState<string[]>(() => original?.stores ?? []);
  const [customStore, setCustomStore] = useState('');

  const toggleStore = (name: string) => {
    setSelectedStores((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    );
  };

  const addCustomStore = () => {
    const trimmed = customStore.trim();
    if (!trimmed) return;
    setSelectedStores((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setCustomStore('');
  };

  if (editing && !original) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Item não encontrado na dispensa.</p>
        <Link to="/dispensa" className="text-brand-600 underline dark:text-brand-400">
          Voltar
        </Link>
      </div>
    );
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const raw = state.raw_text.trim();
    if (!raw) {
      setError('Informe o nome do item');
      return;
    }
    const item: HouseholdItem = {
      id: original?.id ?? `household-${Date.now()}`,
      raw_text: raw,
      quantity: state.quantity ? Number(state.quantity) : null,
      unit: state.unit || null,
      expiry_date: state.no_expiry ? null : state.expiry_date || null,
      no_expiry: state.no_expiry,
      stores: selectedStores,
      price: state.price ? Number(state.price) : null,
      checked: original?.checked ?? false,
      status: state.status,
      added_at: original?.added_at ?? new Date().toISOString(),
      notes: state.notes.trim() || undefined,
      kind: 'household',
    };
    upsertHouseholdItem(item);
    navigate('/dispensa');
  };

  const handleDelete = () => {
    if (!original) return;
    if (!confirm(`Remover "${original.raw_text}" da dispensa?`)) return;
    deleteHouseholdItem(original.id);
    navigate('/dispensa');
  };

  return (
    <form id="household-form" onSubmit={handleSubmit} className="mx-auto max-w-6xl px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {editing ? 'Editar item de casa' : 'Novo item de casa'}
        </h1>
        {editing && (
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
            aria-label="Excluir"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        )}
        <button
          type="submit"
          form="household-form"
          className="shrink-0 rounded-full bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Salvar
        </button>
      </HeaderSlot>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <Field label="Status">
        <div className="grid grid-cols-2 gap-1.5">
          {DISPENSA_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setState((st) => ({ ...st, status: s.value }))}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                state.status === s.value
                  ? 'bg-brand-500 text-white dark:bg-brand-600'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Icon name={s.icon} className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Item de casa">
        <input
          type="text"
          value={state.raw_text}
          onChange={(e) => setState((s) => ({ ...s, raw_text: e.target.value }))}
          className={inputClass}
          placeholder='Ex.: "Papel higiênico", "Sabonete"'
          autoFocus={!editing}
        />
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

      <div className="mb-3">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Data de validade
        </span>
        <label className="mb-2 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={state.no_expiry}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                no_expiry: e.target.checked,
                expiry_date: e.target.checked ? '' : s.expiry_date,
              }))
            }
            className="h-4 w-4 rounded accent-brand-500"
          />
          Sem validade
        </label>
        {!state.no_expiry && (
          <input
            type="date"
            value={state.expiry_date}
            onChange={(e) => setState((s) => ({ ...s, expiry_date: e.target.value }))}
            className={inputClass}
          />
        )}
      </div>

      <Field label="Mercados / lojas (opcional)">
        <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-zinc-300 p-1.5 dark:border-zinc-700">
          {knownStores.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-zinc-400 dark:text-zinc-500">
              Nenhum mercado cadastrado ainda.
            </p>
          ) : (
            knownStores.map((s) => (
              <label
                key={s}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <input
                  type="checkbox"
                  checked={selectedStores.includes(s)}
                  onChange={() => toggleStore(s)}
                  className="h-4 w-4 rounded accent-brand-500"
                />
                <span className="text-sm">{s}</span>
              </label>
            ))
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={customStore}
            onChange={(e) => setCustomStore(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomStore();
              }
            }}
            className={inputClass}
            placeholder="Adicionar outro mercado…"
          />
          <button
            type="button"
            onClick={addCustomStore}
            className="shrink-0 rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Adicionar
          </button>
        </div>
        {selectedStores.filter((s) => !knownStores.includes(s)).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedStores
              .filter((s) => !knownStores.includes(s))
              .map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => toggleStore(s)}
                    aria-label={`Remover ${s}`}
                    className="hover:text-brand-900 dark:hover:text-brand-100"
                  >
                    <Icon name="x" className="h-3 w-3" />
                  </button>
                </span>
              ))}
          </div>
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

      <Field label="Notas (opcional)">
        <textarea
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
          rows={2}
          className={inputClass}
        />
      </Field>

      <Link
        to="/dispensa"
        aria-label="Cancelar"
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-cream text-brand-700 shadow-lg hover:bg-brand-100 dark:bg-brand-cream dark:text-brand-700 dark:hover:bg-brand-100"
      >
        <Icon name="x" className="h-7 w-7" />
      </Link>
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
