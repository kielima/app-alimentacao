import { Link, useParams } from 'react-router-dom';
import { useMemo } from 'react';
import HeaderSlot from '../components/HeaderSlot';
import Icon from '../components/Icon';
import { findIngredientById } from '../data/ingredients';
import { findRecipeById } from '../data/recipes';
import { upsertUserMeal, useUserMeals } from '../data/userMeals';
import { computeMealItemsNutrition } from '../utils/nutrition';
import type { Meal, MealItem, MealItemRef } from '../types/meal';
import { getMealSlots } from '../types/meal';
import { MEAL_TYPES } from '../types/mealPlan';

/** As opções de um item (principal + alternativas). Índice 0 = principal. */
function itemOptions(item: MealItem): MealItemRef[] {
  const principal: MealItemRef = {
    kind: item.kind,
    recipe_id: item.recipe_id,
    ingredient_id: item.ingredient_id,
    quantity: item.quantity,
    unit: item.unit,
  };
  if (!item.substitutes || item.substitutes.length === 0) return [principal];
  return [principal, ...item.substitutes];
}

/** Posição da opção ativa na lista de `itemOptions` (0 = principal). */
function activeOptionIndex(item: MealItem): number {
  return item.active_substitute != null ? item.active_substitute + 1 : 0;
}

interface RefView {
  icon: string;
  name: string;
  to: string | null;
  quantity: number | null;
  unit: string | null;
  missing: boolean;
}

/** Resolve nome, ícone e link de uma opção (receita ou ingrediente). */
function refView(ref: MealItemRef): RefView {
  if (ref.kind === 'recipe' && ref.recipe_id) {
    const recipe = findRecipeById(ref.recipe_id);
    return {
      icon: 'chef-hat',
      name: recipe ? recipe.name : 'Receita não encontrada',
      to: recipe ? `/receitas/${recipe.id}` : null,
      quantity: ref.quantity,
      unit: ref.unit,
      missing: !recipe,
    };
  }
  if (ref.kind === 'ingredient' && ref.ingredient_id) {
    const ing = findIngredientById(ref.ingredient_id);
    return {
      icon: 'carrot',
      name: ing ? (ing.brand ? `${ing.brand} — ${ing.name}` : ing.name) : 'Ingrediente não encontrado',
      to: ing ? `/ingredientes/${ing.id}` : null,
      quantity: ref.quantity,
      unit: ref.unit,
      missing: !ing,
    };
  }
  return { icon: 'carrot', name: 'Item sem vínculo', to: null, quantity: ref.quantity, unit: ref.unit, missing: true };
}

export default function RefeicaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  // Assinatura reativa: alternar a alternativa ativa persiste e recalcula ao vivo.
  const meals = useUserMeals();
  const meal = useMemo(() => (id ? meals.find((m) => m.id === id) : undefined), [meals, id]);
  const nutrition = useMemo(
    () => (meal && meal.items.length > 0 ? computeMealItemsNutrition(meal.items) : null),
    [meal],
  );

  if (!meal) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Refeição não encontrada.</p>
        <Link to="/refeicoes" className="text-brand-600 underline dark:text-brand-400">
          Voltar à lista
        </Link>
      </div>
    );
  }

  const slotDefs = getMealSlots(meal)
    .map((s) => MEAL_TYPES.find((m) => m.value === s))
    .filter((s): s is (typeof MEAL_TYPES)[number] => !!s);

  const setActive = (itemId: string, activeIdx: number | null) => {
    const items = meal.items.map((it) =>
      it.id === itemId ? { ...it, active_substitute: activeIdx } : it,
    );
    upsertUserMeal({ ...meal, items } as Meal);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{meal.name}</h1>
      </HeaderSlot>

      {slotDefs.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {slotDefs.map((slot) => (
            <span
              key={slot.value}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <Icon name={slot.icon} className="h-3.5 w-3.5" /> {slot.label}
            </span>
          ))}
        </div>
      )}

      {meal.notes && (
        <div className="mb-4 rounded-xl bg-zinc-100 px-4 py-3 text-sm whitespace-pre-line dark:bg-zinc-800">
          {meal.notes}
        </div>
      )}

      {nutrition && nutrition.counted > 0 && (
        <div className="mb-4 rounded-xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
          <div className="text-xl font-semibold">
            {nutrition.totals.calories?.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}{' '}
            <span className="text-xs font-normal">kcal</span>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1 text-xs text-zinc-600 dark:text-zinc-300">
            <div>P: {nutrition.totals.protein?.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}g</div>
            <div>C: {nutrition.totals.carbs?.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}g</div>
            <div>G: {nutrition.totals.fat?.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}g</div>
          </div>
          {nutrition.skipped > 0 && (
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {nutrition.skipped} item(ns) sem dados completos
            </p>
          )}
        </div>
      )}

      <section className="mb-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Itens
        </h2>
        {meal.items.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Sem itens ainda.</p>
        ) : (
          <ul className="space-y-1.5">
            {meal.items.map((item) => (
              <ItemView key={item.id} item={item} onSetActive={(idx) => setActive(item.id, idx)} />
            ))}
          </ul>
        )}
      </section>

      <Link
        to={`/refeicoes/${meal.id}/editar`}
        aria-label="Editar refeição"
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

function QtyLabel({ quantity, unit }: { quantity: number | null; unit: string | null }) {
  if (quantity == null) return null;
  return (
    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
      {quantity}
      {unit ? ` ${unit}` : ''}
    </span>
  );
}

function ItemView({ item, onSetActive }: { item: MealItem; onSetActive: (idx: number | null) => void }) {
  const options = itemOptions(item);
  const hasSubs = options.length > 1;

  // Caso simples: item sem alternativas (comportamento original).
  if (!hasSubs) {
    const v = refView(options[0]);
    const inner = (
      <span className="flex w-full items-center gap-2 text-sm">
        <Icon name={v.icon} className="h-4 w-4 shrink-0" />
        <span className={`flex-1 ${v.missing ? 'text-zinc-400 line-through' : ''}`}>{v.name}</span>
        <QtyLabel quantity={v.quantity} unit={v.unit} />
      </span>
    );
    return (
      <li className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        {v.to ? (
          <Link
            to={v.to}
            className="flex items-center hover:text-brand-600 dark:hover:text-brand-400"
          >
            {inner}
          </Link>
        ) : (
          inner
        )}
      </li>
    );
  }

  // Item com alternativas: escolha "um OU outro".
  const activeIdx = activeOptionIndex(item);
  return (
    <li className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <ul>
        {options.map((opt, oi) => {
          const v = refView(opt);
          const isActive = oi === activeIdx;
          const activate = () => onSetActive(oi === 0 ? null : oi - 1);
          const label = (
            <span className="flex flex-1 items-center gap-2 truncate">
              <Icon name={v.icon} className="h-4 w-4 shrink-0" />
              <span
                className={`flex-1 truncate ${
                  v.missing
                    ? 'text-zinc-400 line-through'
                    : isActive
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {v.name}
              </span>
              <QtyLabel quantity={v.quantity} unit={v.unit} />
            </span>
          );
          return (
            <li
              key={oi}
              className={`flex items-center gap-2 px-2.5 py-2 text-sm ${
                oi > 0 ? 'border-t border-zinc-100 dark:border-zinc-800/60' : ''
              }`}
            >
              <button
                type="button"
                onClick={activate}
                aria-label={isActive ? 'Opção em uso' : 'Usar esta opção'}
                aria-pressed={isActive}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    isActive
                      ? 'border-brand-500 dark:border-brand-400'
                      : 'border-zinc-300 dark:border-zinc-600'
                  }`}
                >
                  {isActive && (
                    <span className="block h-2 w-2 rounded-full bg-brand-500 dark:bg-brand-400" />
                  )}
                </span>
              </button>
              {v.to ? (
                <Link to={v.to} className="flex-1 truncate hover:underline">
                  {label}
                </Link>
              ) : (
                label
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}
