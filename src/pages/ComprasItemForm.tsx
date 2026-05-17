import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import {
  getAllIngredients,
  findIngredientById,
  allIngredientIds,
} from '../data/ingredients';
import { upsertUserIngredient } from '../data/userIngredients';
import { getShoppingItem, upsertShoppingItem, deleteShoppingItem, useShoppingItems } from '../data/shoppingList';
import { usePantryItems } from '../data/pantry';
import { useMarkets } from '../data/markets';
import { useAllRecipes, recipeCategories } from '../data/recipes';
import { useAllMeals } from '../data/meals';
import { MEAL_TYPES } from '../types/mealPlan';
import { UNIT_OPTIONS } from '../utils/units';
import { uniqueSlug } from '../utils/slug';
import NutritionTable from '../components/NutritionTable';
import type { ShoppingItem } from '../types/shoppingList';
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
  raw_text: string;
  ingredient_id: string;
  quantity: string;
  unit: string;
  price: string;
}

function itemToForm(item: ShoppingItem | undefined): FormState {
  if (!item) {
    return {
      raw_text: '',
      ingredient_id: '',
      quantity: '',
      unit: '',
      price: '',
    };
  }
  return {
    raw_text: item.raw_text,
    ingredient_id: item.ingredient_id ?? '',
    quantity: item.quantity?.toString() ?? '',
    unit: item.unit ?? '',
    price: item.price?.toString() ?? '',
  };
}

export default function ComprasItemForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const original = id !== undefined ? getShoppingItem(id) : undefined;

  // Hooks must be called before early return
  const returnIngredientId = searchParams.get('ingredient');

  const pantryItems = usePantryItems();
  const shoppingItems = useShoppingItems();
  const markets = useMarkets();
  const allRecipes = useAllRecipes();
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
        raw_text: ing ? ingredientToDisplay(ing.name, ing.brand) : base.raw_text,
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

  // Store state
  const [storeSelect, setStoreSelect] = useState<string>(() => original?.store ?? '');
  const [storeCustom, setStoreCustom] = useState('');

  useEffect(() => {
    if (storeSelect !== '' && storeSelect !== '__outro__' && !knownStores.includes(storeSelect)) {
      setStoreCustom(storeSelect);
      setStoreSelect('__outro__');
    }
  }, [knownStores]); // intentionally only runs when knownStores changes (first load)

  const recipesUsingIngredient = useMemo(() => {
    if (!state.ingredient_id) return [];
    return allRecipes
      .filter((r) => {
        const inMain = r.ingredients?.some((i) => i.ingredient_id === state.ingredient_id);
        const inMolho = r.ingredients_molho?.some((i) => i.ingredient_id === state.ingredient_id);
        return inMain || inMolho;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allRecipes, state.ingredient_id]);

  const mealsUsingIngredient = useMemo(() => {
    if (!state.ingredient_id) return [];
    const recipeIds = new Set(recipesUsingIngredient.map((r) => r.id));
    return allMeals
      .filter((m) =>
        m.items.some(
          (it) =>
            (it.kind === 'ingredient' && it.ingredient_id === state.ingredient_id) ||
            (it.kind === 'recipe' && it.recipe_id && recipeIds.has(it.recipe_id)),
        ),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allMeals, state.ingredient_id, recipesUsingIngredient]);

  if (id !== undefined && !original) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Item não encontrado.</p>
        <Link to="/compras" className="text-brand-600 underline dark:text-brand-400">
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
      setError('Informe o nome do ingrediente');
      return;
    }

    const { brand, name } = parseIngredientDisplay(display);
    const normalizedBrand = brand ?? null;
    let ingredientId: string | null = state.ingredient_id || null;

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

    const storeValue =
      storeSelect === '__outro__' ? storeCustom.trim() || null : storeSelect || null;
    const item: ShoppingItem = {
      id: original?.id ?? `shopping-${Date.now()}`,
      ingredient_id: ingredientId,
      raw_text: display,
      quantity: state.quantity ? Number(state.quantity) : null,
      unit: state.unit || null,
      store: storeValue,
      price: state.price ? Number(state.price) : null,
      checked: original?.checked ?? false,
      source: original?.source ?? 'manual',
      source_ref: original?.source_ref,
      added_at: original?.added_at ?? new Date().toISOString(),
      expiry_date: original?.expiry_date ?? null,
    };
    upsertShoppingItem(item);
    navigate('/compras');
  };

  const handleDelete = () => {
    if (!original) return;
    if (!confirm(`Remover "${original.raw_text}" da lista de compras?`)) return;
    deleteShoppingItem(original.id);
    navigate('/compras');
  };

  const selectDisplayValue =
    storeSelect === '__outro__' || (!knownStores.includes(storeSelect) && storeSelect !== '')
      ? '__outro__'
      : storeSelect;

  return (
    <form id="compras-form" onSubmit={handleSubmit} className="mx-auto max-w-md px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">Editar item</h1>
        {original && (
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-zinc-200/60 px-3 text-sm text-zinc-700 transition-colors hover:bg-red-100 hover:text-red-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-red-900/30 dark:hover:text-red-300"
            aria-label="Excluir"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
        <button
          type="submit"
          form="compras-form"
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

      <Field label="Ingrediente">
        <input
          type="text"
          value={ingredientText}
          onChange={(e) => setIngredientText(e.target.value)}
          className={inputClass}
          placeholder='Ex.: "Urbano — Arroz integral" ou "Arroz"'
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
          <option value="__outro__">➕ Outro...</option>
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

      <Field label="Preço (opcional)">
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={state.price}
          onChange={(e) => setState((s) => ({ ...s, price: e.target.value }))}
          className={inputClass}
          placeholder="R$ —"
        />
      </Field>

      {state.ingredient_id && (() => {
        const ing = findIngredientById(state.ingredient_id);
        return ing ? (
          <section className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Tabela Nutricional
            </h2>
            <NutritionTable ingredient={ing} />
          </section>
        ) : null;
      })()}

      {recipesUsingIngredient.length > 0 && (
        <section className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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
                    <span aria-hidden className="text-lg">
                      {cat?.icon ?? '🍽️'}
                    </span>
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
        <section className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Refeições com este ingrediente ({mealsUsingIngredient.length})
          </h2>
          <ul className="space-y-1.5">
            {mealsUsingIngredient.map((m) => {
              const slotDef = MEAL_TYPES.find((t) => t.value === m.meal_type);
              return (
                <li key={m.id}>
                  <Link
                    to={`/refeicoes/${m.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span aria-hidden className="text-lg">
                      {slotDef?.icon ?? '🍽️'}
                    </span>
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
        to="/compras"
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
