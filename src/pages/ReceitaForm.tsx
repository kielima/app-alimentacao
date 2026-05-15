import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAllIngredients } from '../data/ingredients';
import { findRecipeById, recipeCategories, allRecipeIds } from '../data/recipes';
import { upsertUserRecipe } from '../data/userRecipes';
import { uniqueSlug } from '../utils/slug';
import type { Difficulty, Rating, Recipe, RecipeCategoryId, RecipeIngredient } from '../types/recipe';
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

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'facil', label: '😌 Fácil' },
  { value: 'medio', label: '😅 Médio' },
  { value: 'dificil', label: '🔥 Difícil' },
];

interface FormIngredient {
  raw_text: string;
  ingredient_id: string;
  quantity: string;
  unit: string;
}

interface FormState {
  name: string;
  category: RecipeCategoryId;
  prep_time_min: string;
  difficulty: Difficulty | '';
  rating: Rating | 0;
  notes: string;
  ingredients: FormIngredient[];
  ingredients_molho: FormIngredient[];
  steps: string[];
  steps_natural: string[];
  steps_congelada: string[];
}

function emptyIngredient(): FormIngredient {
  return { raw_text: '', ingredient_id: '', quantity: '', unit: '' };
}

function recipeIngredientToForm(i: RecipeIngredient): FormIngredient {
  return {
    raw_text: i.raw_text,
    ingredient_id: i.ingredient_id ?? '',
    quantity: i.quantity?.toString() ?? '',
    unit: i.unit ?? '',
  };
}

function recipeToForm(r: Recipe | undefined): FormState {
  if (!r) {
    return {
      name: '',
      category: 'pratos-principais',
      prep_time_min: '',
      difficulty: '',
      rating: 0,
      notes: '',
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
    ingredients: (r.ingredients ?? []).length
      ? (r.ingredients ?? []).map(recipeIngredientToForm)
      : [emptyIngredient()],
    ingredients_molho: (r.ingredients_molho ?? []).map(recipeIngredientToForm),
    steps: (r.steps ?? []).length ? (r.steps ?? []) : [''],
    steps_natural: r.steps_natural ?? [],
    steps_congelada: r.steps_congelada ?? [],
  };
}

function formIngredientsToRecipe(
  items: FormIngredient[],
  ingredientMap: Map<string, Ingredient>,
): RecipeIngredient[] {
  return items
    .filter((i) => i.ingredient_id)
    .map((i) => {
      const ing = ingredientMap.get(i.ingredient_id);
      const qty = i.quantity ? Number(i.quantity) : null;
      const unit = i.unit || null;
      const namePart = ing ? (ing.brand ? `${ing.brand} — ${ing.name}` : ing.name) : i.raw_text;
      const raw = qty != null ? `${qty}${unit ? ` ${unit}` : ''} de ${namePart}` : namePart;
      return {
        raw_text: raw || namePart,
        ingredient_id: i.ingredient_id || null,
        quantity: qty,
        unit,
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
    photos: original?.photos ?? [],
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

  const editing = id !== undefined;
  const original = editing ? findRecipeById(id) : undefined;

  const allIng = useAllIngredients();
  const sortedIngredients = useMemo(
    () => [...allIng].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allIng],
  );
  const ingredientMap = useMemo(() => new Map(allIng.map((i) => [i.id, i])), [allIng]);

  const [state, setState] = useState<FormState>(() => recipeToForm(original));
  const [error, setError] = useState<string | null>(null);

  if (editing && !original) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12 text-center">
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
    const ingredients = state.ingredients.filter((i) => i.ingredient_id);
    if (ingredients.length === 0) {
      setError('Selecione ao menos um ingrediente');
      return;
    }
    const steps = state.steps.filter((s) => s.trim());
    if (steps.length === 0) {
      setError('Adicione ao menos um passo no modo de preparo');
      return;
    }

    const recipeId =
      original?.id ?? uniqueSlug(state.name, new Set([...allRecipeIds()]));
    const recipe = formToRecipe(state, original, ingredientMap);
    recipe.id = recipeId;
    upsertUserRecipe(recipe);
    navigate(`/receitas/${recipeId}`);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md px-4 pb-6">
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
        <Link
          to={editing ? `/receitas/${id}` : '/receitas'}
          className="rounded-full bg-zinc-200/60 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
        >
          ✕
        </Link>
        <h1 className="flex-1 truncate text-lg font-semibold">
          {editing ? 'Editar receita' : 'Nova receita'}
        </h1>
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
          onChange={(e) =>
            setState((s) => ({ ...s, category: e.target.value as RecipeCategoryId }))
          }
          className={inputClass}
        >
          {recipeCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
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
                <span className={n <= state.rating ? 'opacity-100' : 'opacity-30'}>⭐</span>
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
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                state.difficulty === d.value
                  ? 'bg-brand-500 text-white dark:bg-brand-600'
                  : 'bg-zinc-200/60 text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60'
              }`}
            >
              {d.label}
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

      <IngredientsSection
        title="Ingredientes"
        items={state.ingredients}
        sortedIngredients={sortedIngredients}
        onChange={(items) => setState((s) => ({ ...s, ingredients: items }))}
      />

      <ExtraIngredientsSection
        title="Ingredientes — molho"
        items={state.ingredients_molho}
        sortedIngredients={sortedIngredients}
        onChange={(items) => setState((s) => ({ ...s, ingredients_molho: items }))}
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
    </form>
  );
}

function IngredientsSection({
  title,
  items,
  sortedIngredients,
  onChange,
}: {
  title: string;
  items: FormIngredient[];
  sortedIngredients: Ingredient[];
  onChange: (items: FormIngredient[]) => void;
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
}: {
  title: string;
  items: FormIngredient[];
  sortedIngredients: Ingredient[];
  onChange: (items: FormIngredient[]) => void;
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
    />
  );
}

function IngredientRow({
  ing,
  sortedIngredients,
  onUpdate,
  onRemove,
}: {
  ing: FormIngredient;
  sortedIngredients: Ingredient[];
  onUpdate: (patch: Partial<FormIngredient>) => void;
  onRemove: () => void;
}) {
  const navigate = useNavigate();
  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 grid grid-cols-[1fr,auto] gap-2">
        <select
          value={ing.ingredient_id}
          onChange={(e) => {
            const newId = e.target.value;
            if (newId === '__new__') {
              navigate('/ingredientes/novo');
              return;
            }
            const matched = sortedIngredients.find((i) => i.id === newId);
            onUpdate({
              ingredient_id: newId,
              unit: matched && !ing.unit ? matched.default_unit : ing.unit,
            });
          }}
          className={`${inputClass} text-sm`}
        >
          <option value="">— Selecione um ingrediente —</option>
          {sortedIngredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.brand ? `${i.brand} — ${i.name}` : i.name}
            </option>
          ))}
          <option value="__new__">➕ Criar novo ingrediente</option>
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md bg-zinc-100 px-2 text-zinc-500 hover:bg-red-100 hover:text-red-700 dark:bg-zinc-800 dark:hover:bg-red-900/30 dark:hover:text-red-300"
          aria-label="Remover ingrediente"
        >
          🗑️
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
    </li>
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
                className="text-zinc-400 disabled:opacity-30"
                aria-label="Mover para cima"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveStep(idx, 1)}
                disabled={idx === items.length - 1}
                className="text-zinc-400 disabled:opacity-30"
                aria-label="Mover para baixo"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => removeStep(idx)}
                className="ml-auto text-zinc-400 hover:text-red-500"
                aria-label="Remover passo"
              >
                🗑️
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
