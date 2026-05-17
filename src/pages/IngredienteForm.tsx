import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import SearchableSelect from '../components/SearchableSelect';
import { uniqueSlug } from '../utils/slug';
import { upsertUserIngredient } from '../data/userIngredients';
import { allIngredientIds, findIngredientById } from '../data/ingredients';
import { upsertOffContribution } from '../data/offContributions';
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
  const scannedBarcode = searchParams.get('barcode') ?? '';
  const returnPath =
    searchParams.get('return') ??
    (editing && existing ? `/ingredientes/${existing.id}` : '/ingredientes');

  const [name, setName] = useState(existing?.name ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [unit, setUnit] = useState<Unit>(existing?.default_unit ?? 'g');
  const [category, setCategory] = useState<IngredientCategory | ''>(existing?.category ?? '');
  const [contributeOff, setContributeOff] = useState(Boolean(scannedBarcode));
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
    const payload: Ingredient = {
      ...(existing ?? {}),
      id,
      name: name.trim(),
      brand: brand.trim() || null,
      default_unit: unit,
      category: category || null,
      nutrition_per_100: existing?.nutrition_per_100 ?? null,
    };
    if (!editing && scannedBarcode) {
      payload.off_barcode = scannedBarcode;
    }
    upsertUserIngredient(payload as Parameters<typeof upsertUserIngredient>[0]);
    if (!editing && scannedBarcode && contributeOff) {
      upsertOffContribution({
        id: `off-${scannedBarcode}`,
        barcode: scannedBarcode,
        product_name: name.trim(),
        brands: brand.trim() || undefined,
        created_at: new Date().toISOString(),
      });
    }
    if (editing) {
      navigate(-1);
      return;
    }
    const dest = returnPath.includes('?')
      ? `${returnPath}&ingredient=${id}`
      : `${returnPath}?ingredient=${id}`;
    navigate(dest, { replace: true });
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

      {scannedBarcode && (
        <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-100 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-1 text-zinc-500 dark:text-zinc-400">Código escaneado</p>
          <p className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{scannedBarcode}</p>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Não estava no Open Food Facts.
          </p>
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
        <SearchableSelect
          value={category}
          onChange={(v) => setCategory(v as IngredientCategory | '')}
          options={[
            { value: '', label: 'Sem categoria' },
            ...INGREDIENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
          ]}
          placeholder="Sem categoria"
        />
      </Field>

      {!editing && scannedBarcode && (
        <label className="mb-3 flex items-start gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
          <input
            type="checkbox"
            checked={contributeOff}
            onChange={(e) => setContributeOff(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-500"
          />
          <span className="text-zinc-700 dark:text-zinc-300">
            Salvar como rascunho para contribuir com o Open Food Facts depois. Você pode revisar
            antes de enviar.
          </span>
        </label>
      )}

      {!editing && (
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Dados nutricionais podem ser adicionados depois na página do ingrediente.
        </p>
      )}

      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Cancelar"
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-2xl text-white shadow-lg hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        ✕
      </button>
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
