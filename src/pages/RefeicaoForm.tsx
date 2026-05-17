import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import SearchableSelect from '../components/SearchableSelect';
import { useAllIngredients } from '../data/ingredients';
import { useAllMeals, findMealById, allMealIds } from '../data/meals';
import { useAllRecipes } from '../data/recipes';
import { upsertUserMeal } from '../data/userMeals';
import { uniqueSlug } from '../utils/slug';
import { MEAL_TYPES, type MealType } from '../types/mealPlan';
import type { Meal, MealItem, MealItemKind } from '../types/meal';

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

interface FormItem {
  id: string;
  kind: MealItemKind;
  ref_id: string;
  quantity: string;
  unit: string;
}

interface FormState {
  name: string;
  meal_type: MealType | '';
  notes: string;
  items: FormItem[];
}

function emptyItem(kind: MealItemKind = 'recipe'): FormItem {
  return {
    id: `meal-form-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    ref_id: '',
    quantity: '',
    unit: '',
  };
}

function mealToForm(m: Meal | undefined): FormState {
  if (!m) {
    return {
      name: '',
      meal_type: '',
      notes: '',
      items: [emptyItem()],
    };
  }
  return {
    name: m.name,
    meal_type: m.meal_type ?? '',
    notes: m.notes ?? '',
    items: m.items.length
      ? m.items.map((i) => ({
          id: i.id,
          kind: i.kind,
          ref_id: i.kind === 'recipe' ? (i.recipe_id ?? '') : (i.ingredient_id ?? ''),
          quantity: i.quantity?.toString() ?? '',
          unit: i.unit ?? '',
        }))
      : [emptyItem()],
  };
}

function formToMeal(state: FormState, original: Meal | undefined): Meal {
  const items: MealItem[] = state.items
    .filter((i) => i.ref_id)
    .map((i) => ({
      id: i.id,
      kind: i.kind,
      recipe_id: i.kind === 'recipe' ? i.ref_id : undefined,
      ingredient_id: i.kind === 'ingredient' ? i.ref_id : undefined,
      quantity: i.quantity ? Number(i.quantity) : null,
      unit: i.unit || null,
    }));
  return {
    ...original,
    id: original?.id ?? '',
    name: state.name.trim(),
    meal_type: state.meal_type || null,
    notes: state.notes.trim() || undefined,
    items,
  };
}

export default function RefeicaoForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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

  const [state, setState] = useState<FormState>(() => mealToForm(original));
  const [error, setError] = useState<string | null>(null);

  if (editing && !original) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12 text-center">
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
    const items = state.items.filter((i) => i.ref_id);
    if (items.length === 0) {
      setError('Adicione ao menos uma receita ou ingrediente');
      return;
    }
    const mealId = original?.id ?? uniqueSlug(state.name, allMealIds());
    const meal = formToMeal(state, original);
    meal.id = mealId;
    upsertUserMeal(meal);
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

  void meals; // placeholder for future cross-refs

  return (
    <form id="refeicao-form" onSubmit={handleSubmit} className="mx-auto max-w-md px-4 pt-2 pb-28">
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

      <Field label="Slot (opcional)">
        <select
          value={state.meal_type}
          onChange={(e) =>
            setState((s) => ({ ...s, meal_type: e.target.value as MealType | '' }))
          }
          className={inputClass}
        >
          <option value="">— Sem slot —</option>
          {MEAL_TYPES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.icon} {m.label}
            </option>
          ))}
        </select>
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
            <li
              key={it.id}
              className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => updateItem(idx, { kind: 'recipe', ref_id: '' })}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    it.kind === 'recipe'
                      ? 'bg-brand-500 text-white dark:bg-brand-600'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  🍳 Receita
                </button>
                <button
                  type="button"
                  onClick={() => updateItem(idx, { kind: 'ingredient', ref_id: '' })}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    it.kind === 'ingredient'
                      ? 'bg-brand-500 text-white dark:bg-brand-600'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  🥕 Ingrediente
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="ml-auto rounded-md bg-zinc-100 px-2 py-1 text-zinc-500 hover:bg-red-100 hover:text-red-700 dark:bg-zinc-800 dark:hover:bg-red-900/30"
                  aria-label="Remover"
                >
                  <span aria-hidden="true" className="text-xl font-bold leading-none text-red-600 dark:text-red-400">×</span>
                </button>
              </div>
              <SearchableSelect
                value={it.ref_id}
                onChange={(newId) => {
                  if (it.kind === 'ingredient') {
                    const matched = sortedIngredients.find((i) => i.id === newId);
                    updateItem(idx, {
                      ref_id: newId,
                      unit: matched && !it.unit ? matched.default_unit : it.unit,
                    });
                  } else {
                    updateItem(idx, { ref_id: newId });
                  }
                }}
                options={
                  it.kind === 'recipe'
                    ? sortedRecipes.map((r) => ({ value: r.id, label: r.name }))
                    : sortedIngredients.map((i) => ({
                        value: i.id,
                        label: i.brand ? `${i.brand} — ${i.name}` : i.name,
                      }))
                }
                placeholder="— Selecione —"
                createLabel={`➕ Criar ${it.kind === 'recipe' ? 'nova receita' : 'novo ingrediente'}`}
                onCreate={() => {
                  const ret = encodeURIComponent(window.location.pathname);
                  navigate(
                    it.kind === 'recipe'
                      ? `/receitas/nova?return=${ret}`
                      : `/ingredientes/novo?return=${ret}`,
                  );
                }}
                className="mb-2"
              />
              <div className="grid grid-cols-[80px,1fr] gap-2">
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={it.quantity}
                  onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                  placeholder="Qtd"
                  className={`${inputClass} text-sm`}
                />
                <select
                  value={it.unit}
                  onChange={(e) => updateItem(idx, { unit: e.target.value })}
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
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-cream text-2xl text-brand-700 shadow-lg hover:bg-brand-100 dark:bg-brand-cream dark:text-brand-700 dark:hover:bg-brand-100"
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
