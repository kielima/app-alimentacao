import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import Icon from '../components/Icon';
import MealTypeChips from '../components/MealTypeChips';
import SearchableSelect from '../components/SearchableSelect';
import TrashIcon from '../components/TrashIcon';
import { useAllIngredients } from '../data/ingredients';
import { useAllMeals, findMealById, allMealIds } from '../data/meals';
import { useAllRecipes } from '../data/recipes';
import { upsertUserMeal } from '../data/userMeals';
import { uniqueSlug } from '../utils/slug';
import { type MealType } from '../types/mealPlan';
import { getMealSlots, type Meal, type MealItem, type MealItemKind, type MealItemRef } from '../types/meal';
import type { Ingredient } from '../types/ingredient';
import type { Recipe } from '../types/recipe';

const UNIT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'unit', label: 'unidade' },
  { value: 'xc', label: 'xícara' },
  { value: 'cs', label: 'colher de sopa' },
  { value: 'cc', label: 'colher de chá' },
  { value: 'fatia', label: 'fatia' },
  { value: 'pct', label: 'pacote' },
  { value: 'a_gosto', label: 'a gosto' },
];

interface FormSubstitute {
  kind: MealItemKind;
  ref_id: string;
  quantity: string;
  unit: string;
}

interface FormItem {
  id: string;
  kind: MealItemKind;
  ref_id: string;
  quantity: string;
  unit: string;
  substitutes: FormSubstitute[];
  /** Índice em `substitutes` da alternativa ativa; null = usar o principal. */
  active_substitute: number | null;
}

interface FormState {
  name: string;
  meal_types: MealType[];
  notes: string;
  items: FormItem[];
}

interface Draft {
  state: FormState;
  pendingItemId: string | null;
  pendingKind: MealItemKind | null;
  /** Quando definido, o slot alvo é a alternativa `pendingSubIndex` do item. */
  pendingSubIndex: number | null;
  editingId: string | null;
}

function draftKeyFor(id: string | undefined) {
  return `refeicao-form-draft:${id ?? 'new'}`;
}

function emptyItem(kind: MealItemKind = 'recipe'): FormItem {
  return {
    id: `meal-form-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    ref_id: '',
    quantity: '',
    unit: '',
    substitutes: [],
    active_substitute: null,
  };
}

function emptySubstitute(kind: MealItemKind = 'recipe'): FormSubstitute {
  return { kind, ref_id: '', quantity: '', unit: '' };
}

function refToForm(ref: MealItemRef): FormSubstitute {
  return {
    kind: ref.kind,
    ref_id: ref.kind === 'recipe' ? (ref.recipe_id ?? '') : (ref.ingredient_id ?? ''),
    quantity: ref.quantity?.toString() ?? '',
    unit: ref.unit ?? '',
  };
}

function mealToForm(m: Meal | undefined): FormState {
  if (!m) {
    return {
      name: '',
      meal_types: [],
      notes: '',
      items: [emptyItem()],
    };
  }
  return {
    name: m.name,
    meal_types: getMealSlots(m),
    notes: m.notes ?? '',
    items: m.items.length
      ? m.items.map((i) => ({
          id: i.id,
          kind: i.kind,
          ref_id: i.kind === 'recipe' ? (i.recipe_id ?? '') : (i.ingredient_id ?? ''),
          quantity: i.quantity?.toString() ?? '',
          unit: i.unit ?? '',
          substitutes: (i.substitutes ?? []).map(refToForm),
          active_substitute: i.active_substitute ?? null,
        }))
      : [emptyItem()],
  };
}

/** Converte um slot do formulário (item ou alternativa) em MealItemRef. Retorna
 *  null quando não há vínculo selecionado. */
function formRefToMeal(ref: FormSubstitute): MealItemRef | null {
  if (!ref.ref_id) return null;
  return {
    kind: ref.kind,
    recipe_id: ref.kind === 'recipe' ? ref.ref_id : undefined,
    ingredient_id: ref.kind === 'ingredient' ? ref.ref_id : undefined,
    quantity: ref.quantity ? Number(ref.quantity) : null,
    unit: ref.unit || null,
  };
}

function formToMeal(state: FormState, original: Meal | undefined): Meal {
  const items: MealItem[] = state.items
    .filter((i) => i.ref_id)
    .map((i) => {
      // Alternativas válidas (com vínculo). Guarda o índice original para
      // remapear a alternativa ativa depois de descartar as vazias.
      const built = i.substitutes
        .map((s, origIdx) => ({ origIdx, ref: formRefToMeal(s) }))
        .filter((x): x is { origIdx: number; ref: MealItemRef } => x.ref !== null);
      const substitutes = built.map((x) => x.ref);
      let active: number | null = null;
      if (i.active_substitute != null) {
        const pos = built.findIndex((x) => x.origIdx === i.active_substitute);
        if (pos >= 0) active = pos;
      }
      const extra =
        substitutes.length > 0
          ? { substitutes, ...(active != null ? { active_substitute: active } : {}) }
          : {};
      return {
        id: i.id,
        kind: i.kind,
        recipe_id: i.kind === 'recipe' ? i.ref_id : undefined,
        ingredient_id: i.kind === 'ingredient' ? i.ref_id : undefined,
        quantity: i.quantity ? Number(i.quantity) : null,
        unit: i.unit || null,
        ...extra,
      };
    });
  return {
    ...original,
    id: original?.id ?? '',
    name: state.name.trim(),
    meal_types: state.meal_types.length ? state.meal_types : null,
    // Sincroniza o campo legado para compatibilidade com leitores antigos.
    meal_type: state.meal_types[0] ?? null,
    notes: state.notes.trim() || undefined,
    items,
  };
}

export default function RefeicaoForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const editing = id !== undefined;
  const original = editing ? findMealById(id) : undefined;
  const meals = useAllMeals();
  const recipes = useAllRecipes();
  const ingredients = useAllIngredients();

  const sortedRecipes = useMemo(
    () => [...recipes].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [recipes],
  );
  const sortedIngredients = useMemo(
    () => [...ingredients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [ingredients],
  );

  const draftKey = draftKeyFor(id);

  const [state, setState] = useState<FormState>(() => {
    const newRecipeId = searchParams.get('recipe');
    const newIngredientId = searchParams.get('ingredient');
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved) as Draft;
        if (draft.editingId === (id ?? null)) {
          let restored = draft.state;
          if (draft.pendingItemId) {
            const incomingId =
              draft.pendingKind === 'recipe'
                ? newRecipeId
                : draft.pendingKind === 'ingredient'
                  ? newIngredientId
                  : null;
            if (incomingId) {
              const unitFor = (kind: MealItemKind | null, currentUnit: string) => {
                if (kind === 'ingredient' && !currentUnit) {
                  const matched = ingredients.find((i) => i.id === incomingId);
                  if (matched) return matched.default_unit;
                }
                return currentUnit;
              };
              restored = {
                ...restored,
                items: restored.items.map((it) => {
                  if (it.id !== draft.pendingItemId) return it;
                  const nextKind = draft.pendingKind ?? it.kind;
                  if (draft.pendingSubIndex != null) {
                    // Vincula o item recém-criado a uma alternativa.
                    const subs = it.substitutes.map((s, si) =>
                      si === draft.pendingSubIndex
                        ? {
                            ...s,
                            kind: nextKind,
                            ref_id: incomingId,
                            unit: unitFor(nextKind, s.unit),
                          }
                        : s,
                    );
                    return { ...it, substitutes: subs };
                  }
                  return {
                    ...it,
                    kind: nextKind,
                    ref_id: incomingId,
                    unit: unitFor(nextKind, it.unit),
                  };
                }),
              };
            }
          }
          return restored;
        }
      }
    } catch {
      // ignore corrupted draft
    }
    return mealToForm(original);
  });
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let dirty = false;
    if (next.has('recipe')) {
      next.delete('recipe');
      dirty = true;
    }
    if (next.has('ingredient')) {
      next.delete('ingredient');
      dirty = true;
    }
    if (dirty) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const draft: Draft = {
      state,
      pendingItemId: null,
      pendingKind: null,
      pendingSubIndex: null,
      editingId: id ?? null,
    };
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // ignore quota errors
    }
  }, [state, draftKey, id]);

  if (editing && !original) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Refeição não encontrada.</p>
        <Link to="/refeicoes" className="text-brand-600 underline dark:text-brand-400">
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
    const mealId = original?.id ?? uniqueSlug(state.name, allMealIds());
    const meal = formToMeal(state, original);
    meal.id = mealId;
    upsertUserMeal(meal);
    sessionStorage.removeItem(draftKey);
    if (editing) {
      navigate(-1);
    } else {
      navigate(`/refeicoes/${mealId}`, { replace: true });
    }
  };

  const updateItem = (idx: number, patch: Partial<FormItem>) =>
    setState((s) => ({
      ...s,
      items: s.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));

  const addItem = (kind: MealItemKind) =>
    setState((s) => ({ ...s, items: [...s.items, emptyItem(kind)] }));

  const removeItem = (idx: number) =>
    setState((s) => ({
      ...s,
      items: s.items.length === 1 ? [emptyItem()] : s.items.filter((_, i) => i !== idx),
    }));

  // Navega para criar uma nova receita/ingrediente, guardando o slot alvo
  // (item principal ou alternativa) para revincular ao voltar.
  const startCreateNew = (
    item: FormItem,
    kind: MealItemKind,
    query: string | undefined,
    subIndex: number | null,
  ) => {
    const draft: Draft = {
      state: stateRef.current,
      pendingItemId: item.id,
      pendingKind: kind,
      pendingSubIndex: subIndex,
      editingId: id ?? null,
    };
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
    const params = new URLSearchParams();
    params.set('return', location.pathname);
    const trimmed = query?.trim();
    if (trimmed) params.set('name', trimmed);
    navigate(
      kind === 'recipe'
        ? `/receitas/nova?${params.toString()}`
        : `/ingredientes/novo?${params.toString()}`,
    );
  };

  void meals; // placeholder for future cross-refs

  return (
    <form id="refeicao-form" onSubmit={handleSubmit} className="mx-auto max-w-6xl px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {editing ? 'Editar refeição' : 'Nova refeição'}
        </h1>
        <button
          type="submit"
          form="refeicao-form"
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
          placeholder="Ex.: Café — Panqueca proteica"
        />
      </Field>

      <Field label="Slots (opcional)">
        <MealTypeChips
          value={state.meal_types}
          onChange={(meal_types) => setState((s) => ({ ...s, meal_types }))}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Toque para escolher um ou mais slots em que esta refeição pode aparecer.
        </p>
      </Field>

      <Field label="Notas (opcional)">
        <textarea
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
          rows={3}
          className={inputClass}
          placeholder="Descrição original, macros aproximados, observações…"
        />
      </Field>

      <section className="mt-6 mb-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Itens
        </h2>
        <ul className="space-y-3">
          {state.items.map((it, idx) => (
            <ItemRow
              key={it.id}
              item={it}
              sortedRecipes={sortedRecipes}
              sortedIngredients={sortedIngredients}
              onUpdate={(patch) => updateItem(idx, patch)}
              onRemove={() => removeItem(idx)}
              onCreateNew={(kind, query, subIndex) => startCreateNew(it, kind, query, subIndex ?? null)}
            />
          ))}
        </ul>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => addItem('recipe')}
            className="rounded-xl border-2 border-dashed border-zinc-300 py-2 text-sm text-zinc-600 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
          >
            + Receita
          </button>
          <button
            type="button"
            onClick={() => addItem('ingredient')}
            className="rounded-xl border-2 border-dashed border-zinc-300 py-2 text-sm text-zinc-600 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
          >
            + Ingrediente
          </button>
        </div>
      </section>

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

/** Um slot (item principal ou alternativa): alternância Receita/Ingrediente,
 *  seletor com busca, quantidade e unidade. */
function RefSlotFields({
  kind,
  ref_id,
  quantity,
  unit,
  sortedRecipes,
  sortedIngredients,
  onChange,
  onCreateNew,
}: {
  kind: MealItemKind;
  ref_id: string;
  quantity: string;
  unit: string;
  sortedRecipes: Recipe[];
  sortedIngredients: Ingredient[];
  onChange: (patch: Partial<FormSubstitute>) => void;
  onCreateNew: (kind: MealItemKind, query?: string) => void;
}) {
  return (
    <>
      <div className="mb-2 flex gap-1">
        <KindToggle
          active={kind === 'recipe'}
          icon="chef-hat"
          label="Receita"
          onClick={() => onChange({ kind: 'recipe', ref_id: '' })}
        />
        <KindToggle
          active={kind === 'ingredient'}
          icon="carrot"
          label="Ingrediente"
          onClick={() => onChange({ kind: 'ingredient', ref_id: '' })}
        />
      </div>
      <SearchableSelect
        value={ref_id}
        onChange={(newId) => {
          if (kind === 'ingredient') {
            const matched = sortedIngredients.find((i) => i.id === newId);
            onChange({ ref_id: newId, unit: matched && !unit ? matched.default_unit : unit });
          } else {
            onChange({ ref_id: newId });
          }
        }}
        options={
          kind === 'recipe'
            ? sortedRecipes.map((r) => ({ value: r.id, label: r.name }))
            : sortedIngredients.map((i) => ({
                value: i.id,
                label: i.brand ? `${i.brand} — ${i.name}` : i.name,
              }))
        }
        placeholder="— Selecione —"
        createLabel={`Criar ${kind === 'recipe' ? 'nova receita' : 'novo ingrediente'}`}
        onCreate={(q) => onCreateNew(kind, q)}
        className="mb-2"
      />
      <div className="grid grid-cols-[80px,1fr] gap-2">
        <input
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
          placeholder="Qtd"
          className={`${inputClass} text-sm`}
        />
        <select
          value={unit}
          onChange={(e) => onChange({ unit: e.target.value })}
          className={`${inputClass} text-sm`}
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function ItemRow({
  item,
  sortedRecipes,
  sortedIngredients,
  onUpdate,
  onRemove,
  onCreateNew,
}: {
  item: FormItem;
  sortedRecipes: Recipe[];
  sortedIngredients: Ingredient[];
  onUpdate: (patch: Partial<FormItem>) => void;
  onRemove: () => void;
  onCreateNew: (kind: MealItemKind, query?: string, subIndex?: number | null) => void;
}) {
  const refLabel = (kind: MealItemKind, ref_id: string, fallback: string): string => {
    if (!ref_id) return fallback;
    if (kind === 'recipe') return sortedRecipes.find((r) => r.id === ref_id)?.name ?? fallback;
    const i = sortedIngredients.find((x) => x.id === ref_id);
    return i ? (i.brand ? `${i.brand} — ${i.name}` : i.name) : fallback;
  };

  const addSubstitute = () =>
    onUpdate({ substitutes: [...item.substitutes, emptySubstitute(item.kind)] });

  const updateSubstitute = (idx: number, patch: Partial<FormSubstitute>) =>
    onUpdate({
      substitutes: item.substitutes.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    });

  const removeSubstitute = (idx: number) => {
    const substitutes = item.substitutes.filter((_, i) => i !== idx);
    // Reajusta a alternativa ativa após a remoção.
    let active = item.active_substitute;
    if (active === idx) active = null;
    else if (active != null && active > idx) active -= 1;
    onUpdate({ substitutes, active_substitute: active });
  };

  const hasSubs = item.substitutes.length > 0;

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center justify-center rounded-md bg-red-100 px-2 py-1 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
          aria-label="Remover item"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      <RefSlotFields
        kind={item.kind}
        ref_id={item.ref_id}
        quantity={item.quantity}
        unit={item.unit}
        sortedRecipes={sortedRecipes}
        sortedIngredients={sortedIngredients}
        onChange={(patch) => onUpdate(patch)}
        onCreateNew={(kind, q) => onCreateNew(kind, q, null)}
      />

      {/* Alternativas (substituições equivalentes: ex. iogurte grego OU whey) */}
      {hasSubs && (
        <div className="mt-3 space-y-2 border-t border-dashed border-zinc-200 pt-3 dark:border-zinc-700">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Alternativas (ou…)
          </p>
          {item.substitutes.map((sub, i) => (
            <div key={i} className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/50">
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeSubstitute(i)}
                  className="inline-flex items-center justify-center rounded-md bg-red-100 px-2 py-1 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                  aria-label="Remover alternativa"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
              <RefSlotFields
                kind={sub.kind}
                ref_id={sub.ref_id}
                quantity={sub.quantity}
                unit={sub.unit}
                sortedRecipes={sortedRecipes}
                sortedIngredients={sortedIngredients}
                onChange={(patch) => updateSubstitute(i, patch)}
                onCreateNew={(kind, q) => onCreateNew(kind, q, i)}
              />
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

      {/* Qual opção conta na nutrição */}
      {hasSubs && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Usar no cálculo
          </p>
          <div className="flex flex-wrap gap-1.5">
            <SubstituteChip
              label={refLabel(item.kind, item.ref_id, 'Principal')}
              active={item.active_substitute == null}
              onClick={() => onUpdate({ active_substitute: null })}
            />
            {item.substitutes.map((sub, i) => (
              <SubstituteChip
                key={i}
                label={refLabel(sub.kind, sub.ref_id, `Alternativa ${i + 1}`)}
                active={item.active_substitute === i}
                onClick={() => onUpdate({ active_substitute: i })}
              />
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

function KindToggle({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs font-medium ${
        active
          ? 'bg-brand-500 text-white dark:bg-brand-600'
          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        <Icon name={icon} className="h-3.5 w-3.5" /> {label}
      </span>
    </button>
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
