import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import SearchableSelect from '../components/SearchableSelect';
import Icon from '../components/Icon';
import NutritionFillActions from '../components/NutritionFillActions';
import MealTypeChips from '../components/MealTypeChips';
import { type MealType } from '../types/mealPlan';
import { uniqueSlug } from '../utils/slug';
import { upsertUserIngredient } from '../data/userIngredients';
import { allIngredientIds, findIngredientById, useAllIngredients } from '../data/ingredients';
import { upsertOffContribution } from '../data/offContributions';
import { useMarkets, upsertMarket } from '../data/markets';
import type { Ingredient, IngredientCategory, Unit } from '../types/ingredient';
import { INGREDIENT_CATEGORIES, getCategoryLabel } from '../types/ingredient';

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

  const initialName = searchParams.get('name') ?? '';
  const [name, setName] = useState(existing?.name ?? initialName);
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [unit, setUnit] = useState<Unit>(existing?.default_unit ?? 'g');
  const [category, setCategory] = useState<IngredientCategory | ''>(existing?.category ?? '');
  const [mealTypes, setMealTypes] = useState<MealType[]>(existing?.meal_types ?? []);
  const [noSuggest, setNoSuggest] = useState(existing?.no_suggest ?? false);
  const [contributeOff, setContributeOff] = useState(Boolean(scannedBarcode));
  const [error, setError] = useState<string | null>(null);

  const markets = useMarkets();
  const initialMarketIds = useMemo(() => {
    if (!existing) return new Set<string>();
    return new Set(markets.filter((m) => m.ingredient_ids.includes(existing.id)).map((m) => m.id));
  }, [markets, existing]);
  const [marketIds, setMarketIds] = useState<Set<string>>(initialMarketIds);
  const [marketSearch, setMarketSearch] = useState('');

  const sortedMarkets = useMemo(
    () => [...markets].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [markets],
  );
  const filteredMarkets = useMemo(() => {
    if (!marketSearch.trim()) return sortedMarkets;
    const q = marketSearch.toLowerCase();
    return sortedMarkets.filter(
      (m) => m.name.toLowerCase().includes(q) || m.address?.toLowerCase().includes(q),
    );
  }, [sortedMarkets, marketSearch]);

  const toggleMarket = (mId: string) => {
    setMarketIds((prev) => {
      const next = new Set(prev);
      if (next.has(mId)) next.delete(mId);
      else next.add(mId);
      return next;
    });
  };

  const allIngs = useAllIngredients();
  const categoryOptions = useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    for (const preset of INGREDIENT_CATEGORIES) {
      seen.set(preset.value.toLowerCase(), preset);
    }
    for (const ing of allIngs) {
      if (ing.category) {
        const key = ing.category.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, { value: ing.category, label: getCategoryLabel(ing.category) });
        }
      }
    }
    return [
      { value: '', label: 'Sem categoria' },
      ...Array.from(seen.values()).sort((a, b) =>
        a.label.localeCompare(b.label, 'pt-BR'),
      ),
    ];
  }, [allIngs]);

  // Ingrediente "ao vivo": mescla o salvo com o que está sendo editado no
  // formulário, para que buscas por nome/IA usem o que o usuário vê na tela.
  const liveIngredient = useMemo<Ingredient | null>(() => {
    if (!existing) return null;
    return {
      ...existing,
      name: name.trim() || existing.name,
      brand: brand.trim() || null,
      default_unit: unit,
      category: category || null,
      meal_types: mealTypes.length ? mealTypes : null,
      no_suggest: noSuggest || undefined,
    };
  }, [existing, name, brand, unit, category, mealTypes, noSuggest]);

  if (editing && !existing) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-12 text-center">
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
      meal_types: mealTypes.length ? mealTypes : null,
      no_suggest: noSuggest,
      nutrition_per_100: existing?.nutrition_per_100 ?? null,
    };
    if (!editing && scannedBarcode) {
      payload.off_barcode = scannedBarcode;
    }
    upsertUserIngredient(payload as Parameters<typeof upsertUserIngredient>[0]);
    for (const market of markets) {
      const wasIn = market.ingredient_ids.includes(id);
      const shouldBeIn = marketIds.has(market.id);
      if (wasIn === shouldBeIn) continue;
      const nextIds = shouldBeIn
        ? [...market.ingredient_ids, id]
        : market.ingredient_ids.filter((mid) => mid !== id);
      upsertMarket({ ...market, ingredient_ids: nextIds });
    }
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
    <form id="ingrediente-form" onSubmit={handleSubmit} className="mx-auto max-w-6xl px-4 pt-2 pb-28">
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
          onChange={(v) => setCategory(v)}
          options={categoryOptions}
          placeholder="Sem categoria"
          createLabel={(q) => `Adicionar "${q.trim()}"`}
          createMode="whenEmpty"
          onCreate={(q) => {
            const trimmed = (q ?? '').trim();
            if (trimmed) setCategory(trimmed);
          }}
        />
      </Field>

      <Field label="Slots (opcional)">
        <MealTypeChips value={mealTypes} onChange={setMealTypes} />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Horários em que este ingrediente pode entrar na montagem automática do plano.
        </p>
        <label className="mt-2 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={noSuggest}
            onChange={(e) => setNoSuggest(e.target.checked)}
            className="h-4 w-4 rounded accent-brand-500"
          />
          Não recomendar nas sugestões do plano
        </label>
      </Field>

      {editing && liveIngredient && (
        <section className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Tabela nutricional
            </span>
            {liveIngredient.nutrition_per_100 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <Icon name="check" className="h-3 w-3" />
                Preenchida
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Sem dados
              </span>
            )}
          </div>
          <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            {liveIngredient.nutrition_per_100
              ? 'Revise ou substitua os valores por uma base consolidada (TBCA → TACO → Open Food Facts), foto do rótulo ou estimativa por IA. Você confere antes de salvar.'
              : 'Preencha por uma base consolidada (TBCA → TACO → Open Food Facts), foto do rótulo ou estimativa por IA. Você confere os valores antes de salvar.'}
          </p>
          <NutritionFillActions ingredient={liveIngredient} />
        </section>
      )}

      {markets.length > 0 && (
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Mercados onde encontro
            </span>
            {marketIds.size > 0 && (
              <span className="text-xs text-brand-600 dark:text-brand-400">
                {marketIds.size} selecionado{marketIds.size !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {markets.length > 5 && (
            <input
              type="search"
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              placeholder="Buscar mercado…"
              className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            />
          )}
          <div className="max-h-52 overflow-y-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {filteredMarkets.length === 0 ? (
              <p className="px-3 py-3 text-sm text-zinc-400 dark:text-zinc-500">
                Nenhum mercado encontrado.
              </p>
            ) : (
              filteredMarkets.map((m) => {
                const checked = marketIds.has(m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      checked ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMarket(m.id)}
                      className="h-4 w-4 rounded accent-brand-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{m.name}</span>
                      {m.address && (
                        <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          {m.address}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </section>
      )}

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
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-cream text-brand-700 shadow-lg hover:bg-brand-100 dark:bg-brand-cream dark:text-brand-700 dark:hover:bg-brand-100"
      >
        <Icon name="x" className="h-7 w-7" />
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
