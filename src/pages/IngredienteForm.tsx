import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import { uniqueSlug } from '../utils/slug';
import { upsertUserIngredient } from '../data/userIngredients';
import { allIngredientIds, findIngredientById } from '../data/ingredients';
import type { Ingredient, IngredientCategory, Unit } from '../types/ingredient';
import { INGREDIENT_CATEGORIES } from '../types/ingredient';

const unitOptions: { value: Unit; label: string }[] = [
  { value: 'g', label: 'g (gramas)' },
  { value: 'ml', label: 'ml (mililitros)' },
  { value: 'unit', label: 'unidade' },
];

export default function IngredienteForm() {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const editing = paramId !== undefined;
  const existing: Ingredient | undefined = editing ? findIngredientById(paramId!) : undefined;
  const returnPath =
    searchParams.get('return') ?? (editing && existing ? `/ingredientes/${existing.id}` : '/ingredientes');

  const [name, setName] = useState(existing?.name ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [unit, setUnit] = useState<Unit>(existing?.default_unit ?? 'g');
  const [category, setCategory] = useState<IngredientCategory | ''>(existing?.category ?? '');
  const [error, setError] = useState<string | null>(null);

  if (editing && !existing) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Ingrediente não encontrado.</p>
        <Link to="/ingredientes" className="text-brand-600 underline dark:text-brand-400">
          Voltar à lista
        </Link>
      </div>
    );
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Informe o nome do ingrediente');
      return;
    }
    const id = existing?.id ?? uniqueSlug(name.trim(), allIngredientIds());
    upsertUserIngredient({
      ...(existing ?? {}),
      id,
      name: name.trim(),
      brand: brand.trim() || null,
      default_unit: unit,
      category: category || null,
      nutrition_per_100: existing?.nutrition_per_100 ?? null,
    } as Parameters<typeof upsertUserIngredient>[0]);
    if (editing) {
      navigate(returnPath);
      return;
    }
    const dest = returnPath.includes('?')
      ? `${returnPath}&ingredient=${id}`
      : `${returnPath}?ingredient=${id}`;
    navigate(dest);
  };

  return (
    <form id="ingrediente-form" onSubmit={handleSubmit} className="mx-auto max-w-md px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {editing ? 'Editar ingrediente' : 'Novo ingrediente'}
        </h1>
        <button
          type="submit"
          form="ingrediente-form"
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

      <Field label="Nome">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          className={inputClass}
          placeholder='Ex.: "Alecrim fresco"'
        />
      </Field>

      <Field label="Marca (opcional)">
        <input
          type="text"
          value={brand ?? ''}
          onChange={(e) => setBrand(e.target.value)}
          className={inputClass}
          placeholder='Ex.: "Urbano"'
        />
      </Field>

      <Field label="Unidade padrão">
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as Unit)}
          className={inputClass}
        >
          {unitOptions.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Categoria">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as IngredientCategory | '')}
          className={inputClass}
        >
          <option value="">Sem categoria</option>
          {INGREDIENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      {!editing && (
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Dados nutricionais podem ser adicionados depois na página do ingrediente.
        </p>
      )}

      <Link
        to={returnPath}
        aria-label="Cancelar"
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-2xl text-white shadow-lg hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        ✕
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
