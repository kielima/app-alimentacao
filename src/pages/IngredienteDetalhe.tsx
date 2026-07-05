import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import TrashIcon from '../components/TrashIcon';
import Icon from '../components/Icon';
import NutritionFillActions from '../components/NutritionFillActions';
import { isSeedIngredient, useAllIngredients } from '../data/ingredients';
import { deleteUserIngredient, getUserIngredientById } from '../data/userIngredients';
import { hideIngredient } from '../data/hiddenIngredients';
import {
  upsertShoppingItem,
  deleteShoppingItem,
  useShoppingItems,
} from '../data/shoppingList';
import {
  upsertPantryItem,
  deletePantryItem,
  usePantryItems,
} from '../data/pantry';
import { useAllRecipes } from '../data/recipes';
import { useRecipeCategories } from '../data/recipeCategories';
import { useAllMeals } from '../data/meals';
import { getMealSlots } from '../types/meal';
import type { MealItemRef } from '../types/meal';
import { MEAL_TYPES } from '../types/mealPlan';
import type { NutritionPer100 } from '../types/ingredient';

const macroLabels: { key: keyof NutritionPer100; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calorias', unit: 'kcal' },
  { key: 'protein', label: 'Proteínas', unit: 'g' },
  { key: 'carbs', label: 'Carboidratos', unit: 'g' },
  { key: 'sugars', label: '— dos quais açúcares', unit: 'g' },
  { key: 'fat', label: 'Gorduras totais', unit: 'g' },
  { key: 'saturated_fat', label: '— das quais saturadas', unit: 'g' },
  { key: 'fiber', label: 'Fibras', unit: 'g' },
  { key: 'sodium', label: 'Sódio', unit: 'mg' },
];

function formatExtraKey(key: string): string {
  const cleaned = key.replace(/_(mg|ug|g)$/, '').replace(/_/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function inferUnitFromKey(key: string): string {
  if (key.endsWith('_mg')) return 'mg';
  if (key.endsWith('_ug')) return 'µg';
  if (key.endsWith('_g')) return 'g';
  return '';
}

function fmt(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

export default function IngredienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const allIngredients = useAllIngredients();
  const ingredient = useMemo(
    () => (id ? allIngredients.find((i) => i.id === id) : undefined),
    [allIngredients, id],
  );

  const [quantity, setQuantity] = useState(100);
  const [showExtras, setShowExtras] = useState(false);
  const shoppingItems = useShoppingItems();
  const pantryItems = usePantryItems();
  const allRecipes = useAllRecipes();
  const recipeCategories = useRecipeCategories();
  const allMeals = useAllMeals();

  const handleDelete = () => {
    if (!id) return;
    const isUser = !!getUserIngredientById(id);
    const isSeed = isSeedIngredient(id);
    const msg = isSeed
      ? 'Apagar este ingrediente? (Ingredientes padrão ficam ocultos e podem ser restaurados depois.)'
      : 'Apagar este ingrediente? Esta ação não pode ser desfeita.';
    if (!confirm(msg)) return;
    if (isUser) deleteUserIngredient(id);
    if (isSeed) hideIngredient(id);
    navigate('/ingredientes');
  };

  const cartMatches = useMemo(
    () =>
      ingredient
        ? shoppingItems.filter((i) => i.ingredient_id === ingredient.id)
        : [],
    [shoppingItems, ingredient],
  );
  const pantryMatches = useMemo(
    () =>
      ingredient
        ? pantryItems.filter((i) => i.ingredient_id === ingredient.id)
        : [],
    [pantryItems, ingredient],
  );
  const addedToCart = cartMatches.length > 0;
  const addedToPantry = pantryMatches.length > 0;

  const handleToggleCart = () => {
    if (!ingredient) return;
    if (addedToCart) {
      cartMatches.forEach((i) => deleteShoppingItem(i.id));
      return;
    }
    upsertShoppingItem({
      id: `from-ingredient-${ingredient.id}-${Date.now()}`,
      ingredient_id: ingredient.id,
      raw_text: ingredient.name,
      quantity: null,
      unit: ingredient.default_unit ?? null,
      store: null,
      price: null,
      checked: false,
      source: 'manual',
      source_ref: ingredient.id,
      added_at: new Date().toISOString(),
    });
  };

  const handleTogglePantry = () => {
    if (!ingredient) return;
    if (addedToPantry) {
      pantryMatches.forEach((i) => deletePantryItem(i.id));
      return;
    }
    upsertPantryItem({
      id: `from-ingredient-${ingredient.id}-${Date.now()}`,
      ingredient_id: ingredient.id,
      raw_text: ingredient.name,
      quantity: null,
      unit: ingredient.default_unit ?? null,
      expiry_date: null,
      store: null,
      added_at: new Date().toISOString(),
    });
  };

  const recipesUsingIngredient = useMemo(() => {
    if (!ingredient) return [];
    return allRecipes
      .filter((r) => {
        const inMain = r.ingredients?.some((i) => i.ingredient_id === ingredient.id);
        const inMolho = r.ingredients_molho?.some((i) => i.ingredient_id === ingredient.id);
        return inMain || inMolho;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allRecipes, ingredient]);

  const mealsUsingIngredient = useMemo(() => {
    if (!ingredient) return [];
    const recipeIds = new Set(recipesUsingIngredient.map((r) => r.id));
    const refMatches = (ref: MealItemRef) =>
      (ref.kind === 'ingredient' && ref.ingredient_id === ingredient.id) ||
      (ref.kind === 'recipe' && !!ref.recipe_id && recipeIds.has(ref.recipe_id));
    return allMeals
      .filter((m) =>
        m.items.some((it) => refMatches(it) || it.substitutes?.some(refMatches)),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allMeals, ingredient, recipesUsingIngredient]);

  const factor = quantity / 100;

  const scaled = useMemo(() => {
    if (!ingredient?.nutrition_per_100) return null;
    const out: Partial<Record<keyof NutritionPer100, number>> = {};
    for (const [k, v] of Object.entries(ingredient.nutrition_per_100)) {
      if (typeof v === 'number') {
        out[k as keyof NutritionPer100] = v * factor;
      }
    }
    return out;
  }, [ingredient, factor]);

  if (!ingredient) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Ingrediente não encontrado.</p>
        <Link
          to="/ingredientes"
          className="text-brand-600 underline dark:text-brand-400"
        >
          Voltar à lista
        </Link>
      </div>
    );
  }

  const unitSuffix = ingredient.default_unit === 'ml' ? 'ml' : 'g';

  return (
    <div className="mx-auto max-w-6xl px-4 pt-2 pb-6">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{ingredient.name}</h1>
        <button
          type="button"
          onClick={handleToggleCart}
          className={`shrink-0 rounded-full px-3 py-1 text-base leading-none transition-colors ${
            addedToCart
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-zinc-100 text-zinc-700 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-brand-900/30 dark:hover:text-brand-400'
          }`}
          aria-label={addedToCart ? 'Remover da lista de compras' : 'Adicionar à lista de compras'}
          title={addedToCart ? 'Remover da lista de compras' : 'Adicionar à lista de compras'}
        >
          <span className="inline-flex items-center justify-center">
            {addedToCart ? (
              <Icon name="check" className="h-4 w-4" />
            ) : (
              <Icon name="shopping-cart" className="h-4 w-4" />
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={handleTogglePantry}
          className={`shrink-0 rounded-full px-3 py-1 text-base leading-none transition-colors ${
            addedToPantry
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-zinc-100 text-zinc-700 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-brand-900/30 dark:hover:text-brand-400'
          }`}
          aria-label={addedToPantry ? 'Remover da dispensa' : 'Adicionar à dispensa'}
          title={addedToPantry ? 'Remover da dispensa' : 'Adicionar à dispensa'}
        >
          <span className="inline-flex items-center justify-center">
            {addedToPantry ? (
              <Icon name="check" className="h-4 w-4" />
            ) : (
              <Icon name="can" className="h-4 w-4" />
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
          aria-label="Excluir ingrediente"
          title="Excluir ingrediente"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </HeaderSlot>

      <div className="mb-4">
        {ingredient.brand && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-brand-600 dark:text-brand-400">{ingredient.brand}</span>
          </p>
        )}
        {ingredient.serving_description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Porção padrão: {ingredient.serving_size_g}
            {unitSuffix} ({ingredient.serving_description})
          </p>
        )}
        {(!ingredient.nutrition_per_100 ||
          (ingredient.needs_review &&
            !ingredient.tbca_code &&
            !ingredient.taco_id &&
            !ingredient.off_barcode)) && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <Icon name="alert-triangle" className="h-4 w-4" />
            Valores nutricionais ainda em revisão
          </p>
        )}
      </div>

      <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Calculadora
        </h2>
        <div className="mb-4 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
            className="w-24 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-base focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
          />
          <span className="text-sm text-zinc-600 dark:text-zinc-300">{unitSuffix}</span>
          {ingredient.serving_size_g && (
            <button
              type="button"
              onClick={() => setQuantity(ingredient.serving_size_g!)}
              className="ml-auto rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              1 porção ({ingredient.serving_size_g}
              {unitSuffix})
            </button>
          )}
        </div>

        {ingredient.nutrition_per_100 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-1 text-left font-normal">Nutriente</th>
                <th className="py-1 text-right font-normal">Por 100{unitSuffix}</th>
                <th className="py-1 text-right font-normal">Por {quantity}{unitSuffix}</th>
              </tr>
            </thead>
            <tbody>
              {macroLabels.map(({ key, label, unit }) => {
                const base = ingredient.nutrition_per_100![key];
                const calc = scaled?.[key];
                const isSubrow = label.startsWith('—');
                return (
                  <tr key={key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className={`py-1.5 ${isSubrow ? 'pl-3 text-zinc-500 dark:text-zinc-400' : ''}`}>
                      {label}
                    </td>
                    <td className="py-1.5 text-right text-zinc-700 dark:text-zinc-300">
                      {fmt(base)} {unit}
                    </td>
                    <td className="py-1.5 text-right font-medium">
                      {fmt(calc)} {unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Sem dados nutricionais cadastrados.
          </p>
        )}

        <div className="mt-3">
          <NutritionFillActions ingredient={ingredient} />
        </div>

        {ingredient.extras_per_100 && Object.keys(ingredient.extras_per_100).length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowExtras((s) => !s)}
              className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400"
            >
              <Icon name={showExtras ? 'chevron-down' : 'chevron-right'} className="h-4 w-4" />
              Micronutrientes ({Object.keys(ingredient.extras_per_100).length})
            </button>
            {showExtras && (
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {Object.entries(ingredient.extras_per_100).map(([k, v]) => (
                    <tr key={k} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                      <td className="py-1.5 text-zinc-600 dark:text-zinc-300">{formatExtraKey(k)}</td>
                      <td className="py-1.5 text-right text-zinc-700 dark:text-zinc-300">
                        {fmt(v as number | null | undefined, 2)} {inferUnitFromKey(k)}
                      </td>
                      <td className="py-1.5 text-right font-medium">
                        {typeof v === 'number'
                          ? `${fmt(v * factor, 2)} ${inferUnitFromKey(k)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {(ingredient.tbca_code || ingredient.taco_id || ingredient.off_barcode) && (
          <div className="mt-4 space-y-2 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {ingredient.taco_id && (
              <p>
                <Icon name="utensils" className="mr-1 inline-block h-4 w-4 align-text-bottom" />
                Composição nutricional da{' '}
                <a
                  href="https://www.nepa.unicamp.br/taco/tabela.php"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 underline hover:no-underline dark:text-brand-400"
                >
                  TACO — Tabela Brasileira de Composição de Alimentos
                </a>{' '}
                (4ª ed., NEPA/UNICAMP).
              </p>
            )}
            {ingredient.tbca_code && (
              <p>
                <Icon name="utensils" className="mr-1 inline-block h-4 w-4 align-text-bottom" />
                Composição nutricional baseada na{' '}
                <a
                  href="http://www.tbca.net.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 underline hover:no-underline dark:text-brand-400"
                >
                  TBCA — Tabela Brasileira de Composição de Alimentos
                </a>{' '}
                (USP/FoRC), código <code className="font-mono">{ingredient.tbca_code}</code>.
              </p>
            )}
            {ingredient.off_barcode && (
              <p>
                <Icon name="tag" className="mr-1 inline-block h-4 w-4 align-text-bottom" />
                Dados do rótulo via{' '}
                <a
                  href={`https://br.openfoodfacts.org/produto/${ingredient.off_barcode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 underline hover:no-underline dark:text-brand-400"
                >
                  Open Food Facts
                </a>
                .
              </p>
            )}
          </div>
        )}
      </section>

      {recipesUsingIngredient.length > 0 && (
        <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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
        <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Refeições com este ingrediente ({mealsUsingIngredient.length})
          </h2>
          <ul className="space-y-1.5">
            {mealsUsingIngredient.map((m) => {
              const firstSlot = getMealSlots(m)[0];
              const slotDef = firstSlot
                ? MEAL_TYPES.find((t) => t.value === firstSlot)
                : undefined;
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

      {(ingredient.ingredients_text || ingredient.allergens) && (
        <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Composição
          </h2>
          {ingredient.ingredients_text && (
            <p className="mb-2 text-sm text-zinc-700 dark:text-zinc-300">
              {ingredient.ingredients_text}
            </p>
          )}
          {ingredient.allergens && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium">Alérgicos:</span> {ingredient.allergens}
            </p>
          )}
        </section>
      )}

      {ingredient.notes && (
        <p className="mb-4 text-xs italic text-zinc-500 dark:text-zinc-400">{ingredient.notes}</p>
      )}

      {ingredient.ceagesp_slug && (
        <p className="mt-6 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <Icon name="leaf" className="mr-1 inline-block h-4 w-4 align-text-bottom" />
          Guia de escolha, variedades e sazonalidade no{' '}
          <a
            href={`https://ceagesp.gov.br/hortiescolha/hortipedia/${ingredient.ceagesp_slug}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 underline hover:no-underline dark:text-brand-400"
          >
            Hortipédia da CEAGESP
          </a>
          .
        </p>
      )}

      <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
        Substitutos · em breve
      </p>

      <Link
        to={`/ingredientes/${ingredient.id}/editar`}
        aria-label="Editar ingrediente"
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-cream text-brand-700 shadow-lg hover:bg-brand-100 dark:bg-brand-cream dark:text-brand-700 dark:hover:bg-brand-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
          aria-hidden
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          <path d="M15 5l4 4" />
        </svg>
      </Link>
    </div>
  );
}
