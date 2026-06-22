import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';
import TrashIcon from '../components/TrashIcon';
import Icon from '../components/Icon';
import HydrationCard from '../components/HydrationCard';
import {
  DAYS_OF_WEEK,
  MEAL_TYPES,
  todayDayOfWeek,
  type DayOfWeek,
  type PlanMeal,
  type PlanMealItem,
  type PlanMealItemKind,
  type MealType,
  type PlanType,
} from '../types/mealPlan';
import { usePlano } from '../contexts/PlanoContext';
import {
  ensureMealStructure,
  emptyDayPlan,
  newPlanMealItem,
  upsertMealPlan,
  useMealPlans,
} from '../data/mealPlan';
import { useAllMeals } from '../data/meals';
import { findRecipeById, useAllRecipes } from '../data/recipes';
import { findIngredientById, useAllIngredients } from '../data/ingredients';
import { computePlanItemsNutrition, type NutritionBreakdown } from '../utils/nutrition';
import { useNutritionTargets } from '../hooks/useNutritionTargets';
import type { NutritionTargets } from '../types/userProfile';
import { getMealSlots, type Meal } from '../types/meal';
import type { Recipe } from '../types/recipe';
import type { Ingredient } from '../types/ingredient';

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

// ── Done-tracking helpers ──────────────────────────────────────────────────

function viewedDate(day: DayOfWeek): string {
  const today = new Date();
  const jsDow = today.getDay(); // 0=Sun..6=Sat
  const todayMon = (jsDow + 6) % 7; // 0=Mon..6=Sun
  const d = new Date(today);
  d.setDate(today.getDate() + (day - todayMon));
  return d.toISOString().slice(0, 10);
}

function doneKey(day: DayOfWeek, planType: PlanType) {
  return `app-alimentacao:done:${viewedDate(day)}:${planType}`;
}

function loadDone(day: DayOfWeek, planType: PlanType): Set<MealType> {
  try {
    const raw = localStorage.getItem(doneKey(day, planType));
    return raw ? new Set(JSON.parse(raw) as MealType[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDone(day: DayOfWeek, planType: PlanType, done: Set<MealType>) {
  localStorage.setItem(doneKey(day, planType), JSON.stringify([...done]));
}

// ──────────────────────────────────────────────────────────────────────────

export default function Plano() {
  const plans = useMealPlans();
  const { day, planType, setDay, setPlanType } = usePlano();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(false);

  // Pré-seleção vinda do app de Ritual: ao tocar em "Abrir" no cartão de uma
  // refeição, o ritual manda para `/#/plano?day=<0-6>&plan=<training_day|rest_day>`.
  // Aplicamos uma vez e limpamos a query, para o usuário poder navegar à mão
  // depois sem ela reverter.
  useEffect(() => {
    const d = searchParams.get('day');
    const p = searchParams.get('plan');
    if (d === null && p === null) return;
    const dNum = Number(d);
    if (d !== null && Number.isInteger(dNum) && dNum >= 0 && dNum <= 6) {
      setDay(dNum as DayOfWeek);
    }
    if (p === 'training_day' || p === 'rest_day') {
      setPlanType(p);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setDay, setPlanType, setSearchParams]);
  const [doneMealTypes, setDoneMealTypes] = useState<Set<MealType>>(
    () => loadDone(todayDayOfWeek(), 'training_day'),
  );

  useEffect(() => {
    setDoneMealTypes(loadDone(day, planType));
  }, [day, planType]);

  const toggleDone = (mealType: MealType) => {
    setDoneMealTypes((prev) => {
      const next = new Set(prev);
      if (next.has(mealType)) next.delete(mealType);
      else next.add(mealType);
      saveDone(day, planType, next);
      return next;
    });
  };

  const allMeals = useAllMeals();
  const allRecipes = useAllRecipes();
  const allIngredients = useAllIngredients();
  const targets = useNutritionTargets();

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

  const consumedItems = useMemo(
    () =>
      dayPlan.meals
        .filter((m) => m.items.length > 0 && doneMealTypes.has(m.meal_type))
        .flatMap((m) => m.items),
    [dayPlan, doneMealTypes],
  );
  const consumedNutrition = useMemo(
    () => (consumedItems.length > 0 ? computePlanItemsNutrition(consumedItems, allMeals) : null),
    [consumedItems, allMeals],
  );

  const totalMealsWithItems = useMemo(
    () => dayPlan.meals.filter((m) => m.items.length > 0).length,
    [dayPlan],
  );
  const doneCount = useMemo(
    () => dayPlan.meals.filter((m) => m.items.length > 0 && doneMealTypes.has(m.meal_type)).length,
    [dayPlan, doneMealTypes],
  );

  const updateMeal = (mealType: MealType, items: PlanMealItem[]) => {
    const next = {
      ...dayPlan,
      meals: dayPlan.meals.map((m) => (m.meal_type === mealType ? { ...m, items } : m)),
    };
    upsertMealPlan(next);
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-2 pb-28">
      <button
        type="button"
        onClick={() => setEditing((e) => !e)}
        aria-label={editing ? 'Concluir edição' : 'Editar plano'}
        className={`fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg transition-colors ${
          editing
            ? 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600'
            : 'bg-brand-cream text-brand-700 hover:bg-brand-100 dark:bg-brand-cream dark:text-brand-700 dark:hover:bg-brand-100'
        }`}
      >
        {editing ? (
          <Icon name="check" className="h-7 w-7" />
        ) : (
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
        )}
      </button>

      <DaySummary
        nutrition={dayNutrition}
        consumed={consumedNutrition}
        doneCount={doneCount}
        totalCount={totalMealsWithItems}
        isToday={isToday}
        dayLabel={dayLabel}
        targets={targets}
      />

      <HydrationCard />

      <ul className="mt-4 space-y-3">
        {dayPlan.meals.map((meal) => (
          <PlanMealCard
            key={meal.meal_type}
            meal={meal}
            editing={editing}
            allMeals={allMeals}
            allRecipes={allRecipes}
            allIngredients={allIngredients}
            onChange={(items) => updateMeal(meal.meal_type, items)}
            isDone={doneMealTypes.has(meal.meal_type)}
            onToggleDone={() => toggleDone(meal.meal_type)}
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
            className="mt-2 inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"
          >
            <Icon name="pencil" className="h-4 w-4" /> Começar a editar{' '}
            <Icon name="arrow-right" className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function DaySummary({
  nutrition,
  consumed,
  doneCount,
  totalCount,
  isToday,
  dayLabel,
  targets,
}: {
  nutrition: NutritionBreakdown | null;
  consumed: NutritionBreakdown | null;
  doneCount: number;
  totalCount: number;
  isToday: boolean;
  dayLabel: string;
  targets: NutritionTargets | null;
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

  const pct = (c: number | undefined, t: number | undefined) =>
    c != null && t != null && t > 0 ? Math.min(100, Math.round((c / t) * 100)) : null;

  const hasConsumed = consumed !== null && consumed.counted > 0;
  const calPct = pct(consumed?.totals.calories, nutrition.totals.calories);

  const macros = [
    { key: 'protein' as const, label: 'P' },
    { key: 'carbs' as const, label: 'C' },
    { key: 'fat' as const, label: 'G' },
  ];

  return (
    <div className="rounded-xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between">
        <p className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {isToday ? (
            <>
              <Icon name="star" className="h-3.5 w-3.5" /> Hoje
            </>
          ) : (
            dayLabel
          )}
        </p>
        {totalCount > 0 && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {doneCount}/{totalCount} feitas
          </span>
        )}
      </div>

      {/* Calories */}
      <div className="text-xl font-semibold">
        {hasConsumed ? (
          <>
            <span>{fmt(consumed!.totals.calories)}</span>
            <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">
              {' '}/ {fmt(nutrition.totals.calories)} kcal
            </span>
          </>
        ) : (
          <>
            {fmt(nutrition.totals.calories)}{' '}
            <span className="text-xs font-normal">kcal</span>
          </>
        )}
      </div>

      {/* Progress bar */}
      {calPct !== null && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-2 rounded-full bg-brand-500 transition-all duration-300 dark:bg-brand-400"
              style={{ width: `${calPct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-brand-600 dark:text-brand-400">
            {calPct}%
          </span>
        </div>
      )}

      {/* Daily target line */}
      {targets && (
        <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
          <span>Meta: {fmt(targets.calories)} kcal</span>
          {hasConsumed && (
            <span>
              {pct(consumed!.totals.calories, targets.calories) ?? 0}% da meta
            </span>
          )}
        </div>
      )}
      {!targets && (
        <Link
          to="/perfil"
          className="mt-1 inline-flex items-center gap-1 text-[10px] text-brand-600 hover:underline dark:text-brand-400"
        >
          Defina seu perfil para ver metas diárias{' '}
          <Icon name="arrow-right" className="h-3.5 w-3.5" />
        </Link>
      )}

      {/* Macros */}
      <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-zinc-600 dark:text-zinc-300">
        {macros.map(({ key, label }) => {
          const total = nutrition.totals[key];
          const cons = consumed?.totals[key];
          const p = pct(cons, total);
          const target = targets?.[key];
          return (
            <div key={key}>
              {hasConsumed ? (
                <>
                  <div>
                    {label}: {fmt(cons, 1)}/{fmt(total, 1)}g
                  </div>
                  {p !== null && (
                    <div className="text-zinc-400 dark:text-zinc-500">{p}%</div>
                  )}
                </>
              ) : (
                <div>
                  {label}: {fmt(total, 1)}g
                </div>
              )}
              {target != null && (
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  Meta: {target}g
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanMealCard({
  meal,
  editing,
  allMeals,
  allRecipes,
  allIngredients,
  onChange,
  isDone,
  onToggleDone,
}: {
  meal: PlanMeal;
  editing: boolean;
  allMeals: Meal[];
  allRecipes: Recipe[];
  allIngredients: Ingredient[];
  onChange: (items: PlanMealItem[]) => void;
  isDone: boolean;
  onToggleDone: () => void;
}) {
  const def = MEAL_TYPES.find((m) => m.value === meal.meal_type);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

  const filteredMeals = useMemo(() => {
    return [...allMeals]
      .filter((m) => {
        const slots = getMealSlots(m);
        return slots.length === 0 || slots.includes(meal.meal_type);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allMeals, meal.meal_type]);

  const sortedRecipes = useMemo(
    () => [...allRecipes].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allRecipes],
  );
  const sortedIngredients = useMemo(
    () => [...allIngredients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allIngredients],
  );
  const ingredientById = useMemo(
    () => new Map(allIngredients.map((i) => [i.id, i])),
    [allIngredients],
  );

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

  const changeKind = (idx: number, kind: PlanMealItemKind) => {
    const current = meal.items[idx];
    if (!current || current.kind === kind) return;
    onChange(
      meal.items.map((it, i) =>
        i === idx
          ? {
              ...newPlanMealItem(kind),
              id: it.id,
            }
          : it,
      ),
    );
  };

  const addItem = (kind: PlanMealItemKind) =>
    onChange([...meal.items, newPlanMealItem(kind)]);
  const removeItem = (idx: number) => onChange(meal.items.filter((_, i) => i !== idx));

  if (!editing && meal.items.length === 0) {
    return null;
  }

  return (
    <li
      className={`rounded-xl border p-3 transition-colors ${
        isDone
          ? 'border-brand-200 bg-brand-50 dark:border-brand-900/50 dark:bg-brand-900/10'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {!editing && (
          <button
            type="button"
            onClick={onToggleDone}
            aria-label={isDone ? 'Desmarcar refeição' : 'Marcar como feita'}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors ${
              isDone
                ? 'border-brand-500 bg-brand-500 text-white dark:border-brand-400 dark:bg-brand-400'
                : 'border-zinc-300 text-transparent hover:border-brand-400 dark:border-zinc-600'
            }`}
          >
            <Icon name="check" className="h-3 w-3" />
          </button>
        )}
        <Icon name={def?.icon ?? 'utensils'} className="h-5 w-5" />
        <h3
          className={`text-sm font-semibold ${
            isDone ? 'text-zinc-400 dark:text-zinc-500' : ''
          }`}
        >
          {def?.label}
        </h3>
        {nutrition && nutrition.counted > 0 && (
          <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
            {nutrition.totals.calories?.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kcal
          </span>
        )}
      </div>

      {meal.items.length === 0 && !editing ? null : (
        <ul className={editing ? 'space-y-2' : 'space-y-1'}>
          {meal.items.map((item, idx) => {
            if (editing) {
              return (
                <li key={item.id} className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-950">
                  <div className="mb-1.5 flex gap-1">
                    <KindChip
                      active={item.kind === 'meal'}
                      onClick={() => changeKind(idx, 'meal')}
                      icon="utensils-crossed"
                      label="Refeição"
                    />
                    <KindChip
                      active={item.kind === 'recipe'}
                      onClick={() => changeKind(idx, 'recipe')}
                      icon="chef-hat"
                      label="Receita"
                    />
                    <KindChip
                      active={item.kind === 'ingredient'}
                      onClick={() => changeKind(idx, 'ingredient')}
                      icon="carrot"
                      label="Ingrediente"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="ml-auto inline-flex items-center justify-center rounded-md bg-red-100 px-2 py-1 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                      aria-label="Remover"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {item.kind === 'meal' && (
                    <SearchableSelect
                      value={item.meal_id ?? ''}
                      onChange={(val) => updateItem(idx, { meal_id: val || null })}
                      options={filteredMeals.map((m) => ({ value: m.id, label: m.name }))}
                      placeholder="Selecione uma refeição…"
                    />
                  )}
                  {item.kind === 'recipe' && (
                    <>
                      <SearchableSelect
                        value={item.recipe_id ?? ''}
                        onChange={(val) => updateItem(idx, { recipe_id: val || null })}
                        options={sortedRecipes.map((r) => ({ value: r.id, label: r.name }))}
                        placeholder="Selecione uma receita…"
                        className="mb-1.5"
                      />
                      <QuantityRow
                        quantity={item.quantity}
                        unit={item.unit ?? ''}
                        onChange={(q, u) => updateItem(idx, { quantity: q, unit: u })}
                      />
                    </>
                  )}
                  {item.kind === 'ingredient' && (
                    <>
                      <SearchableSelect
                        value={item.ingredient_id ?? ''}
                        onChange={(val) => {
                          const matched = val ? ingredientById.get(val) : undefined;
                          updateItem(idx, {
                            ingredient_id: val || null,
                            unit: matched && !item.unit ? matched.default_unit : item.unit,
                          });
                        }}
                        options={sortedIngredients.map((i) => ({
                          value: i.id,
                          label: i.brand ? `${i.brand} — ${i.name}` : i.name,
                        }))}
                        placeholder="Selecione um ingrediente…"
                        className="mb-1.5"
                      />
                      <QuantityRow
                        quantity={item.quantity}
                        unit={item.unit ?? ''}
                        onChange={(q, u) => updateItem(idx, { quantity: q, unit: u })}
                      />
                    </>
                  )}
                </li>
              );
            }
            const isExpanded = expandedItemIds.has(item.id);
            if (item.kind === 'meal') {
              const refeicao = item.meal_id ? mealById.get(item.meal_id) : undefined;
              if (!refeicao) return null;
              return (
                <li key={item.id} className="rounded-lg bg-zinc-50 dark:bg-zinc-950">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.id)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm"
                  >
                    <Icon name="utensils-crossed" className="h-4 w-4" />
                    <span className="flex-1 font-medium text-zinc-900 dark:text-zinc-100">
                      {refeicao.name}
                    </span>
                    <Link
                      to={`/refeicoes/${refeicao.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 text-zinc-400 hover:text-brand-600 dark:text-zinc-500 dark:hover:text-brand-400"
                      aria-label="Ver refeição"
                    >
                      <Icon name="arrow-up-right" className="h-4 w-4" />
                    </Link>
                    <span className="shrink-0 text-zinc-400 dark:text-zinc-500">
                      <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} className="h-4 w-4" />
                    </span>
                  </button>
                  {isExpanded && <MealItemsExpanded meal={refeicao} />}
                </li>
              );
            }
            if (item.kind === 'recipe') {
              const recipe = item.recipe_id ? findRecipeById(item.recipe_id) : undefined;
              if (!recipe) return null;
              return (
                <li key={item.id} className="rounded-lg bg-zinc-50 dark:bg-zinc-950">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                    <Icon name="chef-hat" className="h-4 w-4" />
                    <span className="flex-1 font-medium text-zinc-900 dark:text-zinc-100">
                      {recipe.name}
                    </span>
                    {item.quantity != null && (
                      <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                        {item.quantity}
                        {item.unit ? ` ${item.unit}` : ''}
                      </span>
                    )}
                    <Link
                      to={`/receitas/${recipe.id}`}
                      className="shrink-0 text-zinc-400 hover:text-brand-600 dark:text-zinc-500 dark:hover:text-brand-400"
                      aria-label="Ver receita"
                    >
                      <Icon name="arrow-up-right" className="h-4 w-4" />
                    </Link>
                  </div>
                </li>
              );
            }
            if (item.kind === 'ingredient') {
              const ing = item.ingredient_id ? findIngredientById(item.ingredient_id) : undefined;
              if (!ing) return null;
              return (
                <li key={item.id} className="rounded-lg bg-zinc-50 dark:bg-zinc-950">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                    <Icon name="carrot" className="h-4 w-4" />
                    <span className="flex-1 font-medium text-zinc-900 dark:text-zinc-100">
                      {ing.brand ? `${ing.brand} — ${ing.name}` : ing.name}
                    </span>
                    {item.quantity != null && (
                      <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                        {item.quantity}
                        {item.unit ? ` ${item.unit}` : ''}
                      </span>
                    )}
                    <Link
                      to={`/ingredientes/${ing.id}`}
                      className="shrink-0 text-zinc-400 hover:text-brand-600 dark:text-zinc-500 dark:hover:text-brand-400"
                      aria-label="Ver ingrediente"
                    >
                      <Icon name="arrow-up-right" className="h-4 w-4" />
                    </Link>
                  </div>
                </li>
              );
            }
            return null;
          })}
        </ul>
      )}

      {editing && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => addItem('meal')}
            className="inline-flex items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
          >
            + <Icon name="utensils-crossed" className="h-4 w-4" /> Refeição
          </button>
          <button
            type="button"
            onClick={() => addItem('recipe')}
            className="inline-flex items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
          >
            + <Icon name="chef-hat" className="h-4 w-4" /> Receita
          </button>
          <button
            type="button"
            onClick={() => addItem('ingredient')}
            className="inline-flex items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 hover:border-brand-500 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
          >
            + <Icon name="carrot" className="h-4 w-4" /> Ingrediente
          </button>
        </div>
      )}
    </li>
  );
}

function KindChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[11px] font-medium ${
        active
          ? 'bg-brand-500 text-white dark:bg-brand-600'
          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
      } inline-flex items-center gap-1`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function QuantityRow({
  quantity,
  unit,
  onChange,
}: {
  quantity: number | null;
  unit: string;
  onChange: (quantity: number | null, unit: string) => void;
}) {
  return (
    <div className="grid grid-cols-[80px,1fr] gap-1.5">
      <input
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        value={quantity ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : Number(v), unit);
        }}
        placeholder="Qtd"
        className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
      />
      <select
        value={unit}
        onChange={(e) => onChange(quantity, e.target.value)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
      >
        {UNIT_OPTIONS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>
    </div>
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
              <Icon name="chef-hat" className="h-3.5 w-3.5" />
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
              <Icon name="carrot" className="h-3.5 w-3.5" />
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
