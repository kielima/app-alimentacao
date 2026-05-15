import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DAYS_OF_WEEK,
  MEAL_TYPES,
  todayDayOfWeek,
  type DayOfWeek,
  type Meal,
  type MealItem,
  type MealType,
  type PlanType,
} from '../types/mealPlan';
import {
  ensureMealStructure,
  emptyDayPlan,
  newMealItem,
  upsertMealPlan,
  useMealPlans,
} from '../data/mealPlan';
import { useAllIngredients, findIngredientById } from '../data/ingredients';
import { computeNutrition, type NutritionBreakdown } from '../utils/nutrition';
import { UNIT_OPTIONS, unitLabel } from '../utils/units';
import type { Ingredient } from '../types/ingredient';

export default function Plano() {
  const plans = useMealPlans();
  const [day, setDay] = useState<DayOfWeek>(todayDayOfWeek);
  const [planType, setPlanType] = useState<PlanType>('training_day');
  const [editing, setEditing] = useState(false);

  const allIng = useAllIngredients();
  const sortedIngredients = useMemo(
    () => [...allIng].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [allIng],
  );

  const dayPlan = useMemo(() => {
    const found = plans.find((p) => p.day_of_week === day && p.plan_type === planType);
    return ensureMealStructure(found ?? emptyDayPlan(day, planType));
  }, [plans, day, planType]);

  const dayLabel = DAYS_OF_WEEK.find((d) => d.value === day)?.label ?? '';
  const isToday = day === todayDayOfWeek();

  const allItems = useMemo(() => dayPlan.meals.flatMap((m) => m.items), [dayPlan]);
  const dayNutrition = useMemo(
    () => (allItems.length > 0 ? computeNutrition(allItems) : null),
    [allItems],
  );

  const updateMeal = (mealType: MealType, items: MealItem[]) => {
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
          <MealCard
            key={meal.meal_type}
            meal={meal}
            editing={editing}
            ingredients={sortedIngredients}
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

function MealCard({
  meal,
  editing,
  ingredients,
  onChange,
}: {
  meal: Meal;
  editing: boolean;
  ingredients: Ingredient[];
  onChange: (items: MealItem[]) => void;
}) {
  const def = MEAL_TYPES.find((m) => m.value === meal.meal_type);
  const nutrition = useMemo(
    () => (meal.items.length > 0 ? computeNutrition(meal.items) : null),
    [meal.items],
  );

  const updateItem = (idx: number, patch: Partial<MealItem>) => {
    onChange(meal.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addItem = () => onChange([...meal.items, newMealItem()]);
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
        <ul className={editing ? 'space-y-3' : 'space-y-1'}>
          {meal.items.map((item, idx) => {
            const ing = item.ingredient_id ? findIngredientById(item.ingredient_id) : undefined;
            if (editing) {
              return (
                <li key={item.id} className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-950">
                  <input
                    type="text"
                    value={item.raw_text}
                    onChange={(e) => updateItem(idx, { raw_text: e.target.value })}
                    placeholder='Ex.: "1 banana"'
                    className="mb-1.5 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <div className="grid grid-cols-[1fr,auto] gap-1.5">
                    <select
                      value={item.ingredient_id ?? ''}
                      onChange={(e) => {
                        const matched = ingredients.find((i) => i.id === e.target.value);
                        updateItem(idx, {
                          ingredient_id: e.target.value || null,
                          unit: matched && !item.unit ? matched.default_unit : item.unit,
                        });
                      }}
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="">🔗 Sem vínculo</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.brand ? `${i.brand} — ${i.name}` : i.name}
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
                  <div className="mt-1.5 grid grid-cols-[80px,1fr] gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={item.quantity ?? ''}
                      onChange={(e) =>
                        updateItem(idx, {
                          quantity: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="Qtd"
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <select
                      value={item.unit ?? ''}
                      onChange={(e) => updateItem(idx, { unit: e.target.value || null })}
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
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
            return (
              <li key={item.id} className="text-sm">
                {ing ? (
                  <Link
                    to={`/ingredientes/${ing.id}`}
                    className="text-zinc-900 hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400"
                  >
                    {item.raw_text}
                    {item.quantity != null && item.unit && (
                      <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                        ({item.quantity} {unitLabel(item.unit)})
                      </span>
                    )}
                  </Link>
                ) : (
                  <span>
                    {item.raw_text}
                    {item.quantity != null && item.unit && (
                      <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                        ({item.quantity} {unitLabel(item.unit)})
                      </span>
                    )}
                  </span>
                )}
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
          + Adicionar alimento
        </button>
      )}
    </li>
  );
}
