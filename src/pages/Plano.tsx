import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DAYS_OF_WEEK,
  MEAL_TYPES,
  todayDayOfWeek,
  type DayOfWeek,
  type PlanMeal,
  type PlanMealItem,
  type MealType,
  type PlanType,
} from '../types/mealPlan';
import {
  ensureMealStructure,
  emptyDayPlan,
  newPlanMealItem,
  upsertMealPlan,
  useMealPlans,
} from '../data/mealPlan';
import { useAllMeals } from '../data/meals';
import { findRecipeById } from '../data/recipes';
import { findIngredientById } from '../data/ingredients';
import { computePlanItemsNutrition, type NutritionBreakdown } from '../utils/nutrition';
import type { Meal } from '../types/meal';

export default function Plano() {
  const plans = useMealPlans();
  const [day, setDay] = useState<DayOfWeek>(todayDayOfWeek);
  const [planType, setPlanType] = useState<PlanType>('training_day');
  const [editing, setEditing] = useState(false);

  const allMeals = useAllMeals();

  const dayPlan = useMemo(() => {
    const found = plans.find((p) => p.day_of_week === day && p.plan_type === planType);
    return ensureMealStructure(found ?? emptyDayPlan(day, planType));
  }, [plans, day, planType]);

  const dayLabel = DAYS_OF_WEEK.find((d) => d.value === day)?.label ?? '';
  const isToday = day === todayDayOfWeek();

  const allItems = useMemo(() => dayPlan.meals.flatMap((m) => m.items), [dayPlan]);
  const dayNutrition = useMemo(
    () => (allItems.length > 0 ? computePlanItemsNutrition(allItems, allMeals) : null),
    [allItems, allMeals],
  );

  const updateMeal = (mealType: MealType, items: PlanMealItem[]) => {
    const next = {
      ...dayPlan,
      meals: dayPlan.meals.map((m) => (m.meal_type === mealType ? { ...m, items } : m)),
    };
    upsertMealPlan(next);
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-2 pb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          📅
        </span>
        <h1 className="text-lg font-semibold">Plano Alimentar</h1>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className={`ml-auto rounded-full px-3 py-1.5 text-sm font-medium ${
            editing
              ? 'bg-zinc-200/60 text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200'
              : 'bg-brand-500 text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500'
          }`}
        >
          {editing ? '✓ Concluir' : '✏️ Editar'}
        </button>
      </div>

      <div className="mb-3">
        <Link
          to="/refeicoes"
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-brand-50 hover:text-brand-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-brand-900/30 dark:hover:text-brand-300"
        >
          📋 Minhas Refeições
        </Link>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDay((d) => ((d + 6) % 7) as DayOfWeek)}
          className="rounded-full bg-zinc-200/60 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200"
          aria-label="Dia anterior"
        >
          ◀
        </button>
        <select
          value={day}
          onChange={(e) => setDay(Number(e.target.value) as DayOfWeek)}
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
        >
          {DAYS_OF_WEEK.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
              {d.value === todayDayOfWeek() ? ' (hoje)' : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setDay((d) => ((d + 1) % 7) as DayOfWeek)}
          className="rounded-full bg-zinc-200/60 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200"
          aria-label="Próximo dia"
        >
          ▶
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setPlanType('training_day')}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            planType === 'training_day'
              ? 'bg-brand-500 text-white dark:bg-brand-600'
              : 'bg-zinc-200/60 text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200'
          }`}
        >
          🏋️ Dia de Treino
        </button>
        <button
          type="button"
          onClick={() => setPlanType('rest_day')}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            planType === 'rest_day'
              ? 'bg-brand-500 text-white dark:bg-brand-600'
              : 'bg-zinc-200/60 text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200'
          }`}
        >
          😴 Dia de Descanso
        </button>
      </div>

      <DaySummary nutrition={dayNutrition} isToday={isToday} dayLabel={dayLabel} />

      <ul className="mt-4 space-y-3">
        {dayPlan.meals.map((meal) => (
          <PlanMealCard
            key={meal.meal_type}
            meal={meal}
            editing={editing}
            allMeals={allMeals}
            onChange={(items) => updateMeal(meal.meal_type, items)}
          />
        ))}
      </ul>

      {!allItems.length && !editing && (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Plano vazio para {dayLabel} ({planType === 'training_day' ? 'treino' : 'descanso'}).
          <br />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2 text-brand-600 hover:underline dark:text-brand-400"
          >
            ✏️ Começar a editar →
          </button>
        </div>
      )}
    </div>
  );
}

function DaySummary({
  nutrition,
  isToday,
  dayLabel,
}: {
  nutrition: NutritionBreakdown | null;
  isToday: boolean;
  dayLabel: string;
}) {
  if (!nutrition || nutrition.counted === 0) {
    return (
      <div className="rounded-xl bg-zinc-100 px-4 py-3 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {isToday ? 'Hoje' : dayLabel} — sem dados nutricionais ainda
      </div>
    );
  }
  const fmt = (v: number | undefined, d = 0) =>
    v === undefined ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: d });
  return (
    <div className="rounded-xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
      <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {isToday ? '🌟 Hoje' : dayLabel}
      </p>
      <div className="text-xl font-semibold">
        {fmt(nutrition.totals.calories)} <span className="text-xs font-normal">kcal</span>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1 text-xs text-zinc-600 dark:text-zinc-300">
        <div>P: {fmt(nutrition.totals.protein, 1)}g</div>
        <div>C: {fmt(nutrition.totals.carbs, 1)}g</div>
        <div>G: {fmt(nutrition.totals.fat, 1)}g</div>
      </div>
    </div>
  );
}

function PlanMealCard({
  meal,
  editing,
  allMeals,
  onChange,
}: {
  meal: PlanMeal;
  editing: boolean;
  allMeals: Meal[];
  onChange: (items: PlanMealItem[]) => void;
}) {
  const def = MEAL_TYPES.find((m) => m.value === meal.meal_type);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

  const filteredMeals = useMemo(() => {
    return [...allMeals]
      .filter((m) => !m.meal_type || m.meal_type === meal.meal_type)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allMeals, meal.meal_type]);

  const mealById = useMemo(() => new Map(allMeals.map((m) => [m.id, m])), [allMeals]);

  const nutrition = useMemo(
    () => (meal.items.length > 0 ? computePlanItemsNutrition(meal.items, allMeals) : null),
    [meal.items, allMeals],
  );

  const toggleExpanded = (itemId: string) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const updateItem = (idx: number, patch: Partial<PlanMealItem>) => {
    onChange(meal.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addItem = () => onChange([...meal.items, newPlanMealItem()]);
  const removeItem = (idx: number) => onChange(meal.items.filter((_, i) => i !== idx));

  if (!editing && meal.items.length === 0) {
    return null;
  }

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          {def?.icon}
        </span>
        <h3 className="text-sm font-semibold">{def?.label}</h3>
        {nutrition && nutrition.counted > 0 && (
          <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
            {nutrition.totals.calories?.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kcal
          </span>
        )}
      </div>

      {meal.items.length === 0 && !editing ? null : (
        <ul className={editing ? 'space-y-2' : 'space-y-1'}>
          {meal.items.map((item, idx) => {
            const refeicao = item.meal_id ? mealById.get(item.meal_id) : undefined;
            if (editing) {
              return (
                <li key={item.id} className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-950">
                  <div className="grid grid-cols-[1fr,auto] gap-1.5">
                    <select
                      value={item.meal_id ?? ''}
                      onChange={(e) => updateItem(idx, { meal_id: e.target.value || null })}
                      className="min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="" disabled>
                        Selecione uma refeição…
                      </option>
                      {filteredMeals.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="rounded-md bg-zinc-100 px-2 text-zinc-400 hover:bg-red-100 hover:text-red-700 dark:bg-zinc-800 dark:hover:bg-red-900/30"
                      aria-label="Remover"
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              );
            }
            if (!refeicao) return null;
            const isExpanded = expandedItemIds.has(item.id);
            return (
              <li key={item.id} className="rounded-lg bg-zinc-50 dark:bg-zinc-950">
                <button
                  type="button"
                  onClick={() => toggleExpanded(item.id)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm"
                >
                  <span className="flex-1 font-medium text-zinc-900 dark:text-zinc-100">
                    {refeicao.name}
                  </span>
                  <Link
                    to={`/refeicoes/${refeicao.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-xs text-zinc-400 hover:text-brand-600 dark:text-zinc-500 dark:hover:text-brand-400"
                    aria-label="Ver refeição"
                  >
                    ↗
                  </Link>
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </button>
                {isExpanded && <MealItemsExpanded meal={refeicao} />}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <button
          type="button"
          onClick={addItem}
          className="mt-2 w-full rounded-lg border-2 border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
        >
          + Adicionar refeição
        </button>
      )}
    </li>
  );
}

function MealItemsExpanded({ meal }: { meal: Meal }) {
  if (meal.items.length === 0) {
    return (
      <p className="px-2 pb-2 text-xs text-zinc-400 dark:text-zinc-500">Sem itens cadastrados.</p>
    );
  }
  return (
    <ul className="mx-2 mb-2 space-y-1 border-l-2 border-zinc-200 pl-2 dark:border-zinc-700">
      {meal.items.map((item) => {
        if (item.kind === 'recipe' && item.recipe_id) {
          const recipe = findRecipeById(item.recipe_id);
          return (
            <li key={item.id} className="flex items-center gap-1.5">
              <span className="text-xs" aria-hidden>
                🍳
              </span>
              {recipe ? (
                <Link
                  to={`/receitas/${recipe.id}`}
                  className="flex-1 truncate text-xs text-zinc-700 hover:text-brand-600 dark:text-zinc-300 dark:hover:text-brand-400"
                >
                  {recipe.name}
                </Link>
              ) : (
                <span className="flex-1 text-xs text-zinc-400 line-through">
                  Receita não encontrada
                </span>
              )}
              {item.quantity != null && (
                <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                  {item.quantity}
                  {item.unit ? ` ${item.unit}` : ''}
                </span>
              )}
            </li>
          );
        }
        if (item.kind === 'ingredient' && item.ingredient_id) {
          const ing = findIngredientById(item.ingredient_id);
          return (
            <li key={item.id} className="flex items-center gap-1.5">
              <span className="text-xs" aria-hidden>
                🥕
              </span>
              {ing ? (
                <Link
                  to={`/ingredientes/${ing.id}`}
                  className="flex-1 truncate text-xs text-zinc-700 hover:text-brand-600 dark:text-zinc-300 dark:hover:text-brand-400"
                >
                  {ing.brand ? `${ing.brand} — ${ing.name}` : ing.name}
                </Link>
              ) : (
                <span className="flex-1 text-xs text-zinc-400 line-through">
                  Ingrediente não encontrado
                </span>
              )}
              {item.quantity != null && (
                <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                  {item.quantity}
                  {item.unit ? ` ${item.unit}` : ''}
                </span>
              )}
            </li>
          );
        }
        return null;
      })}
    </ul>
  );
}
