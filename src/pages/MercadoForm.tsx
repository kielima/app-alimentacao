import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import TrashIcon from '../components/TrashIcon';
import Icon from '../components/Icon';
import { getMarket, upsertMarket, deleteMarket } from '../data/markets';
import { useShoppingItems } from '../data/shoppingList';
import { useAllIngredients } from '../data/ingredients';
import type { Market } from '../types/market';

export default function MercadoForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editing = id !== undefined;
  const original = editing ? getMarket(id) : undefined;

  const allIng = useAllIngredients();
  const shoppingItems = useShoppingItems();

  const sortedIng = useMemo(
    () => [...allIng].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allIng],
  );

  const [name, setName] = useState(original?.name ?? '');
  const [address, setAddress] = useState(original?.address ?? '');
  const [notes, setNotes] = useState(original?.notes ?? '');
  const [ingredientIds, setIngredientIds] = useState<Set<string>>(
    () => new Set(original?.ingredient_ids ?? []),
  );
  const [ingSearch, setIngSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filteredIng = useMemo(() => {
    if (!ingSearch.trim()) return sortedIng;
    const q = ingSearch.toLowerCase();
    return sortedIng.filter(
      (i) => i.name.toLowerCase().includes(q) || i.brand?.toLowerCase().includes(q),
    );
  }, [sortedIng, ingSearch]);

  const matchingShoppingItems = useMemo(() => {
    const n = name.trim().toLowerCase();
    if (!n) return [];
    return shoppingItems.filter((i) => i.store?.toLowerCase() === n);
  }, [shoppingItems, name]);

  if (editing && !original) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Mercado não encontrado.</p>
        <Link to="/mercados" className="text-brand-600 underline dark:text-brand-400">
          Voltar
        </Link>
      </div>
    );
  }

  const toggleIngredient = (ingId: string) => {
    setIngredientIds((prev) => {
      const next = new Set(prev);
      if (next.has(ingId)) next.delete(ingId);
      else next.add(ingId);
      return next;
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Nome do mercado é obrigatório');
      return;
    }
    const market: Market = {
      id: original?.id ?? `market-${Date.now()}`,
      name: name.trim(),
      address: address.trim() || null,
      notes: notes.trim() || null,
      ingredient_ids: [...ingredientIds],
      added_at: original?.added_at ?? new Date().toISOString(),
    };
    upsertMarket(market);
    navigate('/mercados');
  };

  const handleDelete = () => {
    if (!original) return;
    if (!confirm(`Excluir o mercado "${original.name}"?`)) return;
    deleteMarket(original.id);
    navigate('/mercados');
  };

  return (
    <form id="mercado-form" onSubmit={handleSubmit} className="mx-auto max-w-md px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {editing ? 'Editar mercado' : 'Novo mercado'}
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
          form="mercado-form"
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

      <Field label="Nome *">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder='Ex.: "Pão de Açúcar"'
          autoFocus={!editing}
        />
      </Field>

      <Field label="Endereço (opcional)">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
          placeholder="Rua, bairro ou cidade"
        />
      </Field>

      <Field label="Notas (opcional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={inputClass}
          placeholder="Horário de funcionamento, dicas…"
        />
      </Field>

      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Ingredientes disponíveis
          </span>
          {ingredientIds.size > 0 && (
            <span className="text-xs text-brand-600 dark:text-brand-400">
              {ingredientIds.size} selecionado{ingredientIds.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <input
          type="search"
          value={ingSearch}
          onChange={(e) => setIngSearch(e.target.value)}
          placeholder="Buscar ingrediente…"
          className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="max-h-52 overflow-y-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {filteredIng.length === 0 ? (
            <p className="px-3 py-3 text-sm text-zinc-400 dark:text-zinc-500">
              Nenhum ingrediente encontrado.
            </p>
          ) : (
            filteredIng.map((ing) => {
              const checked = ingredientIds.has(ing.id);
              return (
                <label
                  key={ing.id}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    checked ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleIngredient(ing.id)}
                    className="h-4 w-4 rounded accent-brand-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{ing.name}</span>
                    {ing.brand && (
                      <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                        {ing.brand}
                      </span>
                    )}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </section>

      {matchingShoppingItems.length > 0 && (
        <section className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-3 dark:border-brand-900/40 dark:bg-brand-900/20">
          <h2 className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            <Icon name="shopping-cart" className="h-4 w-4" />
            {matchingShoppingItems.length} item
            {matchingShoppingItems.length !== 1 ? 's' : ''} na lista de compras
          </h2>
          <ul className="space-y-1">
            {matchingShoppingItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                {item.checked && <Icon name="check" className="h-3.5 w-3.5 text-zinc-400" />}
                <span
                  className={`text-sm ${
                    item.checked
                      ? 'text-zinc-400 line-through'
                      : 'text-brand-900 dark:text-brand-100'
                  }`}
                >
                  {item.raw_text}
                </span>
                {item.price != null && (
                  <span className="ml-auto text-xs text-zinc-500">
                    {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <Link
            to="/compras"
            className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400"
          >
            Ver lista de compras
            <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        </section>
      )}

      <Link
        to="/mercados"
        aria-label="Cancelar"
        className="fixed bottom-4 right-4 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-cream text-brand-700 shadow-lg hover:bg-brand-100 dark:bg-brand-cream dark:text-brand-700 dark:hover:bg-brand-100"
      >
        <Icon name="x" className="h-6 w-6" />
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
