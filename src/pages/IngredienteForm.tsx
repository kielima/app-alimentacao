import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { uniqueSlug } from '../utils/slug';
import { upsertUserIngredient } from '../data/userIngredients';
import { allIngredientIds } from '../data/ingredients';
import { upsertOffContribution } from '../data/offContributions';
import type { IngredientCategory, Unit } from '../types/ingredient';
import { INGREDIENT_CATEGORIES } from '../types/ingredient';

const unitOptions: { value: Unit; label: string }[] = [
  { value: 'g', label: 'g (gramas)' },
  { value: 'ml', label: 'ml (mililitros)' },
  { value: 'unit', label: 'unidade' },
];

export default function IngredienteForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = searchParams.get('return') ?? '/ingredientes';
  const scannedBarcode = searchParams.get('barcode') ?? '';

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState<Unit>('g');
  const [category, setCategory] = useState<IngredientCategory | ''>('');
  const [contributeOff, setContributeOff] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scannedBarcode) setContributeOff(false);
  }, [scannedBarcode]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Informe o nome do ingrediente');
      return;
    }
    const id = uniqueSlug(name.trim(), allIngredientIds());
    upsertUserIngredient({
      id,
      name: name.trim(),
      brand: brand.trim() || null,
      default_unit: unit,
      category: category || null,
      nutrition_per_100: null,
      off_barcode: scannedBarcode || undefined,
    } as Parameters<typeof upsertUserIngredient>[0]);
    if (scannedBarcode && contributeOff) {
      upsertOffContribution({
        id: `off-${scannedBarcode}`,
        barcode: scannedBarcode,
        product_name: name.trim(),
        brands: brand.trim() || undefined,
        created_at: new Date().toISOString(),
      });
    }
    const dest = returnPath.includes('?')
      ? `${returnPath}&ingredient=${id}`
      : `${returnPath}?ingredient=${id}`;
    navigate(dest);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md px-4 pb-6">
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
        <Link
          to={returnPath}
          className="rounded-full bg-zinc-200/60 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
        >
          ✕
        </Link>
        <h1 className="flex-1 truncate text-lg font-semibold">Novo ingrediente</h1>
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
          value={brand}
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

      {scannedBarcode && (
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

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Dados nutricionais podem ser adicionados depois na página do ingrediente.
      </p>
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
