import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import Icon from '../components/Icon';
import { useAllIngredients } from '../data/ingredients';
import SearchableSelect from '../components/SearchableSelect';
import TrashIcon from '../components/TrashIcon';
import { findRecipeById, allRecipeIds } from '../data/recipes';
import { useRecipeCategories } from '../data/recipeCategories';
import { upsertUserRecipe } from '../data/userRecipes';
import { uniqueSlug } from '../utils/slug';
import { compressImageToDataUrl } from '../utils/image';
import type { Difficulty, Rating, Recipe, RecipeIngredient } from '../types/recipe';
import type { Ingredient } from '../types/ingredient';

const UNIT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'unit', label: 'unidade' },
  { value: 'xc', label: 'xícara' },
  { value: 'cs', label: 'colher de sopa' },
  { value: 'cc', label: 'colher de chá' },
  { value: 'dt', label: 'dente' },
  { value: 'mç', label: 'maço' },
  { value: 'pct', label: 'pacote' },
  { value: 'a_gosto', label: 'a gosto' },
];

const DIFFICULTIES: { value: Difficulty; label: string; icon: string }[] = [
  { value: 'facil', label: 'Fácil', icon: 'smile' },
  { value: 'medio', label: 'Médio', icon: 'meh' },
  { value: 'dificil', label: 'Difícil', icon: 'flame' },
];

interface FormSubstitute {
  ingredient_id: string;
  quantity: string;
  unit: string;
}

interface FormIngredient {
  raw_text: string;
  ingredient_id: string;
  quantity: string;
  unit: string;
  substitutes: FormSubstitute[];
  /** Índice em `substitutes` da alternativa ativa; null = usar o principal. */
  active_substitute: number | null;
}

type IngredientSection = 'main' | 'molho';

interface PendingSlot {
  section: IngredientSection;
  index: number;
  /** Quando definido, o slot alvo é a alternativa `subIndex` do ingrediente. */
  subIndex?: number;
}

interface Draft {
  state: FormState;
  pendingSlot: PendingSlot | null;
  editingId: string | null;
}

function draftKeyFor(id: string | undefined) {
  return `receita-form-draft:${id ?? 'new'}`;
}

interface FormState {
  name: string;
  category: string;
  prep_time_min: string;
  difficulty: Difficulty | '';
  rating: Rating | 0;
  notes: string;
  photos: string[];
  ingredients: FormIngredient[];
  ingredients_molho: FormIngredient[];
  steps: string[];
  steps_natural: string[];
  steps_congelada: string[];
}

function emptyIngredient(): FormIngredient {
  return { raw_text: '', ingredient_id: '', quantity: '', unit: '', substitutes: [], active_substitute: null };
}

function emptySubstitute(): FormSubstitute {
  return { ingredient_id: '', quantity: '', unit: '' };
}

function recipeIngredientToForm(i: RecipeIngredient): FormIngredient {
  return {
    raw_text: i.raw_text,
    ingredient_id: i.ingredient_id ?? '',
    quantity: i.quantity?.toString() ?? '',
    unit: i.unit ?? '',
    substitutes: (i.substitutes ?? []).map((s) => ({
      ingredient_id: s.ingredient_id ?? '',
      quantity: s.quantity?.toString() ?? '',
      unit: s.unit ?? '',
    })),
    active_substitute: i.active_substitute ?? null,
  };
}

function recipeToForm(r: Recipe | undefined, initialName = ''): FormState {
  if (!r) {
    return {
      name: initialName,
      category: 'pratos-principais',
      prep_time_min: '',
      difficulty: '',
      rating: 0,
      notes: '',
      photos: [],
      ingredients: [emptyIngredient()],
      ingredients_molho: [],
      steps: [''],
      steps_natural: [],
      steps_congelada: [],
    };
  }
  return {
    name: r.name,
    category: r.category,
    prep_time_min: r.prep_time_min?.toString() ?? '',
    difficulty: r.difficulty ?? '',
    rating: r.rating ?? 0,
    notes: r.notes ?? '',
    photos: r.photos ?? [],
    ingredients: (r.ingredients ?? []).length
      ? (r.ingredients ?? []).map(recipeIngredientToForm)
      : [emptyIngredient()],
    ingredients_molho: (r.ingredients_molho ?? []).map(recipeIngredientToForm),
    steps: (r.steps ?? []).length ? (r.steps ?? []) : [''],
    steps_natural: r.steps_natural ?? [],
    steps_congelada: r.steps_congelada ?? [],
  };
}

/** Constrói o `raw_text` de exibição de um ingrediente vinculado ao catálogo. */
function buildRawText(ing: Ingredient, qty: number | null, unit: string | null): string {
  const namePart = ing.brand ? `${ing.brand} — ${ing.name}` : ing.name;
  const raw = qty != null ? `${qty}${unit ? ` ${unit}` : ''} de ${namePart}` : namePart;
  return raw || namePart;
}

/** Converte uma alternativa (só vale com ingrediente do catálogo) em RecipeIngredient. */
function formSubstituteToRecipe(
  s: FormSubstitute,
  ingredientMap: Map<string, Ingredient>,
): RecipeIngredient | null {
  const ing = s.ingredient_id ? ingredientMap.get(s.ingredient_id) : undefined;
  if (!ing) return null;
  const qty = s.quantity ? Number(s.quantity) : null;
  const unit = s.unit || null;
  return { raw_text: buildRawText(ing, qty, unit), ingredient_id: s.ingredient_id, quantity: qty, unit };
}

function formIngredientsToRecipe(
  items: FormIngredient[],
  ingredientMap: Map<string, Ingredient>,
): RecipeIngredient[] {
  return items
    // Mantém linhas com ingrediente do catálogo OU com texto livre (ex.: itens
    // de uma receita importada que não casaram com um ingrediente do catálogo).
    .filter((i) => i.ingredient_id || i.raw_text.trim())
    .map((i) => {
      const ing = i.ingredient_id ? ingredientMap.get(i.ingredient_id) : undefined;
      const qty = i.quantity ? Number(i.quantity) : null;
      const unit = i.unit || null;

      // Alternativas válidas (com ingrediente do catálogo). Guarda o índice
      // original para remapear a alternativa ativa após descartar as vazias.
      const built = i.substitutes
        .map((s, origIdx) => ({ origIdx, rec: formSubstituteToRecipe(s, ingredientMap) }))
        .filter((x): x is { origIdx: number; rec: RecipeIngredient } => x.rec !== null);
      const substitutes = built.map((x) => x.rec);
      let active: number | null = null;
      if (i.active_substitute != null) {
        const pos = built.findIndex((x) => x.origIdx === i.active_substitute);
        if (pos >= 0) active = pos;
      }
      const extra =
        substitutes.length > 0
          ? { substitutes, ...(active != null ? { active_substitute: active } : {}) }
          : {};

      if (!ing) {
        return { raw_text: i.raw_text.trim(), ingredient_id: null, quantity: qty, unit, ...extra };
      }
      return {
        raw_text: buildRawText(ing, qty, unit),
        ingredient_id: i.ingredient_id || null,
        quantity: qty,
        unit,
        ...extra,
      };
    });
}

function formToRecipe(
  state: FormState,
  original: Recipe | undefined,
  ingredientMap: Map<string, Ingredient>,
): Recipe {
  const ingredients = formIngredientsToRecipe(state.ingredients, ingredientMap);
  const ingredients_molho = formIngredientsToRecipe(state.ingredients_molho, ingredientMap);
  const steps = state.steps.map((s) => s.trim()).filter(Boolean);
  const steps_natural = state.steps_natural.map((s) => s.trim()).filter(Boolean);
  const steps_congelada = state.steps_congelada.map((s) => s.trim()).filter(Boolean);

  return {
    ...original,
    id: original?.id ?? '',
    name: state.name.trim(),
    category: state.category,
    prep_time_min: state.prep_time_min ? Number(state.prep_time_min) : null,
    difficulty: state.difficulty || null,
    rating: state.rating || null,
    photos: state.photos,
    ingredients,
    ingredients_molho: ingredients_molho.length > 0 ? ingredients_molho : undefined,
    steps,
    steps_natural: steps_natural.length > 0 ? steps_natural : undefined,
    steps_congelada: steps_congelada.length > 0 ? steps_congelada : undefined,
    notes: state.notes.trim() || undefined,
    source_lines: original?.source_lines ?? [0, 0],
    needs_review: false,
  };
}

export default function ReceitaForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const editing = id !== undefined;
  const original = editing ? findRecipeById(id) : undefined;

  const allIng = useAllIngredients();
  const sortedIngredients = useMemo(
    () => [...allIng].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allIng],
  );
  const ingredientMap = useMemo(() => new Map(allIng.map((i) => [i.id, i])), [allIng]);
  const categories = useRecipeCategories();

  const draftKey = draftKeyFor(id);

  const [state, setState] = useState<FormState>(() => {
    const newIngredientId = searchParams.get('ingredient');
    const initialName = searchParams.get('name') ?? '';
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved) as Draft;
        if (draft.editingId === (id ?? null)) {
          let restored = draft.state;
          if (newIngredientId && draft.pendingSlot) {
            const { section, index, subIndex } = draft.pendingSlot;
            const key = section === 'molho' ? 'ingredients_molho' : 'ingredients';
            const list = [...restored[key]];
            const target = list[index];
            if (target) {
              if (subIndex != null) {
                // Vincula o ingrediente recém-criado a uma alternativa.
                const subs = [...target.substitutes];
                if (subs[subIndex]) {
                  subs[subIndex] = { ...subs[subIndex], ingredient_id: newIngredientId };
                  list[index] = { ...target, substitutes: subs };
                }
              } else {
                list[index] = { ...target, ingredient_id: newIngredientId };
              }
            }
            restored = { ...restored, [key]: list };
          }
          return restored;
        }
      }
    } catch {
      // ignore corrupted draft
    }
    return recipeToForm(original, initialName);
  });
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setState((s) => ({ ...s, photos: [dataUrl] }));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Falha ao processar a imagem.');
    }
  };

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let dirty = false;
    if (next.has('ingredient')) {
      next.delete('ingredient');
      dirty = true;
    }
    if (next.has('name')) {
      next.delete('name');
      dirty = true;
    }
    if (dirty) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const draft: Draft = {
      state,
      pendingSlot: null,
      editingId: id ?? null,
    };
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // ignore quota errors
    }
  }, [state, draftKey, id]);

  const handleCreateNewIngredient = (
    section: IngredientSection,
    index: number,
    query?: string,
    subIndex?: number,
  ) => {
    const draft: Draft = {
      state: stateRef.current,
      pendingSlot: { section, index, subIndex },
      editingId: id ?? null,
    };
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
    const returnPath = searchParams.get('return');
    const returnUrl = `${location.pathname}${returnPath ? `?return=${encodeURIComponent(returnPath)}` : ''}`;
    const params = new URLSearchParams();
    params.set('return', returnUrl);
    const trimmed = query?.trim();
    if (trimmed) params.set('name', trimmed);
    navigate(`/ingredientes/novo?${params.toString()}`);
  };

  if (editing && !original) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Receita não encontrada.</p>
        <Link to="/receitas" className="text-brand-600 underline dark:text-brand-400">
          Voltar à lista
        </Link>
      </div>
    );
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!state.name.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    const recipeId =
      original?.id ?? uniqueSlug(state.name, new Set([...allRecipeIds()]));
    const recipe = formToRecipe(state, original, ingredientMap);
    recipe.id = recipeId;
    upsertUserRecipe(recipe);
    sessionStorage.removeItem(draftKey);
    if (editing) {
      navigate(-1);
      return;
    }
    const returnPath = searchParams.get('return');
    if (returnPath) {
      const dest = returnPath.includes('?')
        ? `${returnPath}&recipe=${recipeId}`
        : `${returnPath}?recipe=${recipeId}`;
      navigate(dest, { replace: true });
      return;
    }
    navigate(`/receitas/${recipeId}`, { replace: true });
  };

  return (
    <form id="recipe-form" onSubmit={handleSubmit} className="mx-auto max-w-6xl px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {editing ? 'Editar receita' : 'Nova receita'}
        </h1>
        <button
          type="submit"
          form="recipe-form"
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
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          required
          className={inputClass}
          placeholder="Ex.: Bolo de Fubá da Vovó"
        />
      </Field>

      <Field label="Categoria">
        <select
          value={state.category}
          onChange={(e) => setState((s) => ({ ...s, category: e.target.value }))}
          className={inputClass}
        >
          {/* Categoria da receita que não existe mais na lista (ex.: apagada) */}
          {categories.every((c) => c.id !== state.category) && (
            <option value={state.category}>Sem categoria</option>
          )}
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tempo (min)">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={state.prep_time_min}
            onChange={(e) => setState((s) => ({ ...s, prep_time_min: e.target.value }))}
            className={inputClass}
            placeholder="—"
          />
        </Field>
        <Field label="Avaliação">
          <div className="flex gap-1 pt-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() =>
                  setState((s) => ({ ...s, rating: s.rating === n ? 0 : (n as Rating) }))
                }
                aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
                className="text-2xl"
              >
                <Icon
                  name="star"
                  className={`h-6 w-6 text-amber-500 ${n <= state.rating ? 'opacity-100' : 'opacity-30'}`}
                />
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Dificuldade">
        <div className="flex gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() =>
                setState((s) => ({ ...s, difficulty: s.difficulty === d.value ? '' : d.value }))
              }
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                state.difficulty === d.value
                  ? 'bg-brand-500 text-white dark:bg-brand-600'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Icon name={d.icon} className="h-4 w-4" /> {d.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Notas (opcional)">
        <textarea
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
          rows={2}
          className={inputClass}
          placeholder="Observações sobre a receita…"
        />
      </Field>

      <Field label="Foto (opcional)">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handlePhoto(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {state.photos[0] ? (
          <div className="relative">
            <img
              src={state.photos[0]}
              alt="Foto da receita"
              className="h-44 w-full rounded-xl object-cover"
            />
            <div className="absolute right-2 top-2 flex gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow hover:bg-white dark:bg-zinc-900/90 dark:text-zinc-200"
              >
                <Icon name="upload" className="h-3.5 w-3.5" /> Trocar
              </button>
              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, photos: [] }))}
                className="inline-flex items-center justify-center rounded-full bg-white/90 p-1.5 text-red-600 shadow hover:bg-white dark:bg-zinc-900/90 dark:text-red-400"
                aria-label="Remover foto"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-300 text-sm text-zinc-500 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-brand-400 dark:hover:text-brand-400"
          >
            <Icon name="upload" className="h-6 w-6" />
            Tirar foto ou escolher da galeria
          </button>
        )}
        {photoError && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{photoError}</p>
        )}
      </Field>

      <IngredientsSection
        title="Ingredientes"
        items={state.ingredients}
        sortedIngredients={sortedIngredients}
        onChange={(items) => setState((s) => ({ ...s, ingredients: items }))}
        onCreateNew={(idx, query, subIndex) =>
          handleCreateNewIngredient('main', idx, query, subIndex)
        }
      />

      <ExtraIngredientsSection
        title="Ingredientes — molho"
        items={state.ingredients_molho}
        sortedIngredients={sortedIngredients}
        onChange={(items) => setState((s) => ({ ...s, ingredients_molho: items }))}
        onCreateNew={(idx, query, subIndex) =>
          handleCreateNewIngredient('molho', idx, query, subIndex)
        }
      />

      <StepsSection
        title="Modo de preparo"
        items={state.steps}
        onChange={(items) => setState((s) => ({ ...s, steps: items }))}
      />

      <ExtraStepsSection
        title="Modo de preparo — natural"
        items={state.steps_natural}
        onChange={(items) => setState((s) => ({ ...s, steps_natural: items }))}
      />

      <ExtraStepsSection
        title="Modo de preparo — congelada"
        items={state.steps_congelada}
        onChange={(items) => setState((s) => ({ ...s, steps_congelada: items }))}
      />

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

function IngredientsSection({
  title,
  items,
  sortedIngredients,
  onChange,
  onCreateNew,
}: {
  title: string;
  items: FormIngredient[];
  sortedIngredients: Ingredient[];
  onChange: (items: FormIngredient[]) => void;
  onCreateNew: (index: number, query?: string, subIndex?: number) => void;
}) {
  const updateItem = (idx: number, patch: Partial<FormIngredient>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () => onChange([...items, emptyIngredient()]);
  const removeItem = (idx: number) =>
    onChange(items.length === 1 ? [emptyIngredient()] : items.filter((_, i) => i !== idx));

  return (
    <section className="mt-6 mb-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      <ul className="space-y-3">
        {items.map((ing, idx) => (
          <IngredientRow
            key={idx}
            ing={ing}
            sortedIngredients={sortedIngredients}
            onUpdate={(patch) => updateItem(idx, patch)}
            onRemove={() => removeItem(idx)}
            onCreateNew={(query, subIndex) => onCreateNew(idx, query, subIndex)}
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={addItem}
        className="mt-2 w-full rounded-xl border-2 border-dashed border-zinc-300 py-2.5 text-sm text-zinc-600 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-brand-400 dark:hover:text-brand-400"
      >
        + Adicionar ingrediente
      </button>
    </section>
  );
}

function ExtraIngredientsSection({
  title,
  items,
  sortedIngredients,
  onChange,
  onCreateNew,
}: {
  title: string;
  items: FormIngredient[];
  sortedIngredients: Ingredient[];
  onChange: (items: FormIngredient[]) => void;
  onCreateNew: (index: number, query?: string, subIndex?: number) => void;
}) {
  if (items.length === 0) {
    return (
      <button
        type="button"
        onClick={() => onChange([emptyIngredient()])}
        className="mt-2 mb-4 w-full rounded-xl border border-dashed border-zinc-300 py-2 text-xs text-zinc-500 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
      >
        + {title}
      </button>
    );
  }
  return (
    <IngredientsSection
      title={title}
      items={items}
      sortedIngredients={sortedIngredients}
      onChange={onChange}
      onCreateNew={onCreateNew}
    />
  );
}

function IngredientRow({
  ing,
  sortedIngredients,
  onUpdate,
  onRemove,
  onCreateNew,
}: {
  ing: FormIngredient;
  sortedIngredients: Ingredient[];
  onUpdate: (patch: Partial<FormIngredient>) => void;
  onRemove: () => void;
  onCreateNew: (query?: string, subIndex?: number) => void;
}) {
  const options = sortedIngredients.map((i) => ({
    value: i.id,
    label: i.brand ? `${i.brand} — ${i.name}` : i.name,
  }));
  const labelFor = (id: string) => options.find((o) => o.value === id)?.label ?? 'Alternativa';

  const addSubstitute = () =>
    onUpdate({ substitutes: [...ing.substitutes, emptySubstitute()] });

  const updateSubstitute = (idx: number, patch: Partial<FormSubstitute>) =>
    onUpdate({
      substitutes: ing.substitutes.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    });

  const removeSubstitute = (idx: number) => {
    const substitutes = ing.substitutes.filter((_, i) => i !== idx);
    // Reajusta a alternativa ativa após a remoção.
    let active = ing.active_substitute;
    if (active === idx) active = null;
    else if (active != null && active > idx) active -= 1;
    onUpdate({ substitutes, active_substitute: active });
  };

  const hasSubs = ing.substitutes.length > 0;

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr),auto] gap-2">
        <SearchableSelect
          value={ing.ingredient_id}
          onChange={(newId) => {
            const matched = sortedIngredients.find((i) => i.id === newId);
            onUpdate({
              ingredient_id: newId,
              unit: matched && !ing.unit ? matched.default_unit : ing.unit,
            });
          }}
          options={options}
          placeholder="— Selecione um ingrediente —"
          createLabel="Criar novo ingrediente"
          onCreate={(query) => onCreateNew(query)}
        />
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center justify-center rounded-md bg-red-100 px-2 py-1 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
          aria-label="Remover ingrediente"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-[80px,1fr] gap-2">
        <input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={ing.quantity}
          onChange={(e) => onUpdate({ quantity: e.target.value })}
          placeholder="Qtd"
          className={`${inputClass} text-sm`}
        />
        <select
          value={ing.unit}
          onChange={(e) => onUpdate({ unit: e.target.value })}
          className={`${inputClass} text-sm`}
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      {/* Alternativas (substituições equivalentes: ex. leite em pó OU whey) */}
      {hasSubs && (
        <div className="mt-3 space-y-2 border-t border-dashed border-zinc-200 pt-3 dark:border-zinc-700">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Alternativas (ou…)
          </p>
          {ing.substitutes.map((sub, i) => (
            <div key={i} className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/50">
              <div className="mb-2 grid grid-cols-[minmax(0,1fr),auto] gap-2">
                <SearchableSelect
                  value={sub.ingredient_id}
                  onChange={(newId) => {
                    const matched = sortedIngredients.find((x) => x.id === newId);
                    updateSubstitute(i, {
                      ingredient_id: newId,
                      unit: matched && !sub.unit ? matched.default_unit : sub.unit,
                    });
                  }}
                  options={options}
                  placeholder="— Ingrediente alternativo —"
                  createLabel="Criar novo ingrediente"
                  onCreate={(query) => onCreateNew(query, i)}
                />
                <button
                  type="button"
                  onClick={() => removeSubstitute(i)}
                  className="inline-flex items-center justify-center rounded-md bg-red-100 px-2 py-1 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                  aria-label="Remover alternativa"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-[80px,1fr] gap-2">
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={sub.quantity}
                  onChange={(e) => updateSubstitute(i, { quantity: e.target.value })}
                  placeholder="Qtd"
                  className={`${inputClass} text-sm`}
                />
                <select
                  value={sub.unit}
                  onChange={(e) => updateSubstitute(i, { unit: e.target.value })}
                  className={`${inputClass} text-sm`}
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addSubstitute}
        className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
      >
        + Adicionar alternativa
      </button>

      {/* Qual opção conta na nutrição / vai para a lista de compras */}
      {hasSubs && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Usar no cálculo
          </p>
          <div className="flex flex-wrap gap-1.5">
            <SubstituteChip
              label={ing.ingredient_id ? labelFor(ing.ingredient_id) : 'Principal'}
              active={ing.active_substitute == null}
              onClick={() => onUpdate({ active_substitute: null })}
            />
            {ing.substitutes.map((sub, i) => (
              <SubstituteChip
                key={i}
                label={sub.ingredient_id ? labelFor(sub.ingredient_id) : `Alternativa ${i + 1}`}
                active={ing.active_substitute === i}
                onClick={() => onUpdate({ active_substitute: i })}
              />
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

function SubstituteChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-brand-500 text-white dark:bg-brand-600'
          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
      }`}
    >
      {active && <Icon name="check" className="h-3 w-3 shrink-0" />}
      <span className="truncate">{label}</span>
    </button>
  );
}

function StepsSection({
  title,
  items,
  onChange,
}: {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const updateStep = (idx: number, value: string) =>
    onChange(items.map((st, i) => (i === idx ? value : st)));
  const moveStep = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };
  const addStep = () => onChange([...items, '']);
  const removeStep = (idx: number) =>
    onChange(items.length === 1 ? [''] : items.filter((_, i) => i !== idx));

  return (
    <section className="mt-6 mb-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      <ul className="space-y-2">
        {items.map((step, idx) => (
          <li
            key={idx}
            className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => moveStep(idx, -1)}
                disabled={idx === 0}
                className="inline-flex items-center justify-center text-zinc-400 disabled:opacity-30"
                aria-label="Mover para cima"
              >
                <Icon name="chevron-up" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveStep(idx, 1)}
                disabled={idx === items.length - 1}
                className="inline-flex items-center justify-center text-zinc-400 disabled:opacity-30"
                aria-label="Mover para baixo"
              >
                <Icon name="chevron-down" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => removeStep(idx)}
                className="ml-auto inline-flex items-center justify-center text-red-500 hover:text-red-700"
                aria-label="Remover passo"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={step}
              onChange={(e) => updateStep(idx, e.target.value)}
              rows={2}
              placeholder={`Passo ${idx + 1}…`}
              className={`${inputClass} text-sm`}
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addStep}
        className="mt-2 w-full rounded-xl border-2 border-dashed border-zinc-300 py-2.5 text-sm text-zinc-600 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-brand-400 dark:hover:text-brand-400"
      >
        + Adicionar passo
      </button>
    </section>
  );
}

function ExtraStepsSection({
  title,
  items,
  onChange,
}: {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  if (items.length === 0) {
    return (
      <button
        type="button"
        onClick={() => onChange([''])}
        className="mt-2 mb-4 w-full rounded-xl border border-dashed border-zinc-300 py-2 text-xs text-zinc-500 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
      >
        + {title}
      </button>
    );
  }
  return <StepsSection title={title} items={items} onChange={onChange} />;
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
