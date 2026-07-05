import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import {
  getAllIngredients,
  findIngredientById,
  allIngredientIds,
} from '../data/ingredients';
import { upsertUserIngredient } from '../data/userIngredients';
import { getPantryItem, upsertPantryItem, deletePantryItem, usePantryItems } from '../data/pantry';
import { useShoppingItems } from '../data/shoppingList';
import { useMarkets } from '../data/markets';
import { UNIT_OPTIONS } from '../utils/units';
import { uniqueSlug } from '../utils/slug';
import NutritionTable from '../components/NutritionTable';
import TrashIcon from '../components/TrashIcon';
import Icon from '../components/Icon';
import { useAllRecipes } from '../data/recipes';
import { useRecipeCategories } from '../data/recipeCategories';
import { useAllMeals } from '../data/meals';
import { getMealSlots } from '../types/meal';
import type { MealItemRef } from '../types/meal';
import { MEAL_TYPES } from '../types/mealPlan';
import type { PantryItem } from '../types/pantry';
import type { Unit } from '../types/ingredient';

const INGREDIENT_SEPARATOR = ' — ';

function ingredientToDisplay(name: string, brand?: string | null): string {
  return brand ? `${brand}${INGREDIENT_SEPARATOR}${name}` : name;
}

function parseIngredientDisplay(text: string): { brand: string | null; name: string } {
  const trimmed = text.trim();
  const idx = trimmed.indexOf(INGREDIENT_SEPARATOR);
  if (idx > -1) {
    const brand = trimmed.substring(0, idx).trim();
    const name = trimmed.substring(idx + INGREDIENT_SEPARATOR.length).trim();
    if (brand && name) return { brand, name };
  }
  return { brand: null, name: trimmed };
}

interface FormState {
  ingredient_id: string;
  quantity: string;
  unit: string;
  expiry_date: string;
  no_expiry: boolean;
  notes: string;
}

function itemToForm(item: PantryItem | undefined): FormState {
  if (!item) {
    return {
      ingredient_id: '',
      quantity: '',
      unit: '',
      expiry_date: '',
      no_expiry: false,
      notes: '',
    };
  }
  return {
    ingredient_id: item.ingredient_id ?? '',
    quantity: item.quantity?.toString() ?? '',
    unit: item.unit ?? '',
    expiry_date: item.expiry_date ?? '',
    no_expiry: item.no_expiry ?? false,
    notes: item.notes ?? '',
  };
}

export default function DispensaForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editing = id !== undefined;
  const original = editing ? getPantryItem(id) : undefined;

  // Hooks must be called before early return
  const returnIngredientId = searchParams.get('ingredient');

  const pantryItems = usePantryItems();
  const shoppingItems = useShoppingItems();
  const markets = useMarkets();
  const allRecipes = useAllRecipes();
  const recipeCategories = useRecipeCategories();
  const allMeals = useAllMeals();
  const knownStores = useMemo(() => {
    const fromItems = [...pantryItems, ...shoppingItems]
      .map((i) => i.store)
      .filter((s): s is string => !!s && s.trim() !== '');
    const fromMarkets = markets.map((m) => m.name);
    return [...new Set([...fromMarkets, ...fromItems])].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }, [pantryItems, shoppingItems, markets]);

  const [state, setState] = useState<FormState>(() => {
    const base = itemToForm(original);
    if (returnIngredientId) {
      const ing = getAllIngredients().find((i) => i.id === returnIngredientId);
      return {
        ...base,
        ingredient_id: returnIngredientId,
        unit: base.unit || (ing?.default_unit ?? ''),
      };
    }
    return base;
  });

  const [ingredientText, setIngredientText] = useState<string>(() => {
    const linkedId = returnIngredientId ?? original?.ingredient_id ?? '';
    if (linkedId) {
      const ing = getAllIngredients().find((i) => i.id === linkedId);
      if (ing) return ingredientToDisplay(ing.name, ing.brand);
    }
    return original?.raw_text ?? '';
  });

  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'food' | 'household'>(
    original?.kind === 'household' ? 'household' : 'food',
  );

  // Store state
  const [storeSelect, setStoreSelect] = useState<string>(() => original?.store ?? '');
  const [storeCustom, setStoreCustom] = useState('');

  useEffect(() => {
    if (storeSelect !== '' && storeSelect !== '__outro__' && !knownStores.includes(storeSelect)) {
      setStoreCustom(storeSelect);
      setStoreSelect('__outro__');
    }
  }, [knownStores]); // intentionally only runs when knownStores changes (first load)

  const ing = useMemo(
    () => (mode === 'food' && state.ingredient_id ? findIngredientById(state.ingredient_id) : undefined),
    [mode, state.ingredient_id],
  );

  const recipesUsingIngredient = useMemo(() => {
    if (!ing) return [];
    return allRecipes
      .filter((r) => {
        const inMain = r.ingredients?.some((i) => i.ingredient_id === ing.id);
        const inMolho = r.ingredients_molho?.some((i) => i.ingredient_id === ing.id);
        return inMain || inMolho;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allRecipes, ing]);

  const mealsUsingIngredient = useMemo(() => {
    if (!ing) return [];
    const recipeIds = new Set(recipesUsingIngredient.map((r) => r.id));
    const refMatches = (ref: MealItemRef) =>
      (ref.kind === 'ingredient' && ref.ingredient_id === ing.id) ||
      (ref.kind === 'recipe' && !!ref.recipe_id && recipeIds.has(ref.recipe_id));
    return allMeals
      .filter((m) =>
        m.items.some((it) => refMatches(it) || it.substitutes?.some(refMatches)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allMeals, ing, recipesUsingIngredient]);

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
    const display = ingredientText.trim();
    if (!display) {
      setError(mode === 'household' ? 'Informe o nome do item' : 'Informe o nome do ingrediente');
      return;
    }

    // Itens de casa nunca criam ingrediente — ficam com ingredient_id null para
    // não vazar para o catálogo de ingredientes nem para receitas.
    let ingredientId: string | null = null;
    if (mode === 'food') {
      const { brand, name } = parseIngredientDisplay(display);
      const normalizedBrand = brand ?? null;
      ingredientId = state.ingredient_id || null;

      const linked = ingredientId ? findIngredientById(ingredientId) : undefined;
      if (linked) {
        const currentBrand = linked.brand ?? null;
        if (linked.name !== name || currentBrand !== normalizedBrand) {
          upsertUserIngredient({
            ...linked,
            name,
            brand: normalizedBrand,
          });
        }
      } else {
        const fallbackUnit: Unit =
          state.unit === 'g' || state.unit === 'ml' || state.unit === 'unit'
            ? state.unit
            : 'g';
        const newId = uniqueSlug(name, allIngredientIds());
        upsertUserIngredient({
          id: newId,
          name,
          brand: normalizedBrand,
          default_unit: fallbackUnit,
          nutrition_per_100: null,
        });
        ingredientId = newId;
      }
    }

    const storeValue =
      storeSelect === '__outro__' ? storeCustom.trim() || null : storeSelect || null;
    const item: PantryItem = {
      id: original?.id ?? `pantry-${Date.now()}`,
      ingredient_id: ingredientId,
      raw_text: display,
      quantity: state.quantity ? Number(state.quantity) : null,
      unit: state.unit || null,
      expiry_date: state.no_expiry ? null : state.expiry_date || null,
      no_expiry: state.no_expiry,
      store: storeValue,
      added_at: original?.added_at ?? new Date().toISOString(),
      notes: state.notes.trim() || undefined,
      kind: mode === 'household' ? 'household' : 'food',
    };
    upsertPantryItem(item);
    navigate('/dispensa');
  };

  const handleDelete = () => {
    if (!original) return;
    if (!confirm(`Remover "${original.raw_text}" da dispensa?`)) return;
    deletePantryItem(original.id);
    navigate('/dispensa');
  };

  const selectDisplayValue =
    storeSelect === '__outro__' || (!knownStores.includes(storeSelect) && storeSelect !== '')
      ? '__outro__'
      : storeSelect;

  return (
    <form id="dispensa-form" onSubmit={handleSubmit} className="mx-auto max-w-6xl px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {editing ? 'Editar item' : 'Novo item'}
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
          form="dispensa-form"
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

      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {([
          { value: 'food', label: 'Comida', icon: 'utensils-crossed' },
          { value: 'household', label: 'Item de casa', icon: 'package' },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setMode(opt.value)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === opt.value
                ? 'bg-brand-500 text-white dark:bg-brand-600'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Icon name={opt.icon} className="h-4 w-4" />
            {opt.label}
          </button>
        ))}
      </div>

      <Field label={mode === 'household' ? 'Item de casa' : 'Ingrediente'}>
        <input
          type="text"
          value={ingredientText}
          onChange={(e) => setIngredientText(e.target.value)}
          className={inputClass}
          placeholder={
            mode === 'household'
              ? 'Ex.: "Papel higiênico", "Sabonete"'
              : 'Ex.: "Urbano — Arroz integral" ou "Arroz"'
          }
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

      <Field label="Mercado / loja (opcional)">
        <select
          value={selectDisplayValue}
          onChange={(e) => {
            setStoreSelect(e.target.value);
            if (e.target.value !== '__outro__') setStoreCustom('');
          }}
          className={inputClass}
        >
          <option value="">— Sem mercado</option>
          {knownStores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="__outro__">Outro...</option>
        </select>
        {storeSelect === '__outro__' && (
          <input
            type="text"
            value={storeCustom}
            onChange={(e) => {
              setStoreCustom(e.target.value);
            }}
            className={`${inputClass} mt-2`}
            placeholder='Ex.: "Pão de Açúcar"'
            autoFocus
          />
        )}
      </Field>

      <Field label="Notas (opcional)">
        <textarea
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
          rows={2}
          className={inputClass}
        />
      </Field>

      {ing && (
        <section className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Tabela Nutricional
          </h2>
          <NutritionTable ingredient={ing} />
        </section>
      )}

      {recipesUsingIngredient.length > 0 && (
        <section className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Receitas com este ingrediente ({recipesUsingIngredient.length})
          </h2>
          <ul className="space-y-1.5">
            {recipesUsingIngredient.map((r) => {
              const cat = recipeCategories.find((c) => c.id === r.category);
              return (
                <li key={r.id}>
                  <Link
                    to={`/receitas/${r.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Icon name={cat?.icon ?? 'utensils'} className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {mealsUsingIngredient.length > 0 && (
        <section className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Refeições com este ingrediente ({mealsUsingIngredient.length})
          </h2>
          <ul className="space-y-1.5">
            {mealsUsingIngredient.map((m) => {
              const firstSlot = getMealSlots(m)[0];
              const slotDef = firstSlot ? MEAL_TYPES.find((t) => t.value === firstSlot) : undefined;
              return (
                <li key={m.id}>
                  <Link
                    to={`/refeicoes/${m.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Icon name={slotDef?.icon ?? 'utensils'} className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    <span className="text-zinc-400 dark:text-zinc-500">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
