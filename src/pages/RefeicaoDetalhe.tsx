import { Link, useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { findMealById } from '../data/meals';
import { findIngredientById } from '../data/ingredients';
import { findRecipeById } from '../data/recipes';
import { computeMealItemsNutrition } from '../utils/nutrition';
import { MEAL_TYPES } from '../types/mealPlan';

export default function RefeicaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const meal = id ? findMealById(id) : undefined;
  const nutrition = useMemo(
    () => (meal && meal.items.length > 0 ? computeMealItemsNutrition(meal.items) : null),
    [meal],
  );

  if (!meal) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Refeição não encontrada.</p>
        <Link to="/refeicoes" className="text-brand-600 underline dark:text-brand-400">
          Voltar à lista
        </Link>
      </div>
    );
  }

  const slotDef = MEAL_TYPES.find((m) => m.value === meal.meal_type);

  return (
    <div className="mx-auto max-w-md px-4 pb-6">
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
        <Link
          to="/refeicoes"
          className="rounded-full bg-zinc-200/60 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
        >
          ←
        </Link>
        <h1 className="flex-1 truncate text-lg font-semibold">{meal.name}</h1>
        <Link
          to={`/refeicoes/${meal.id}/editar`}
          className="rounded-full bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          ✏️ Editar
        </Link>
      </div>

      {slotDef && (
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          <span aria-hidden>{slotDef.icon}</span> {slotDef.label}
        </p>
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
            {meal.items.map((item) => {
              if (item.kind === 'recipe' && item.recipe_id) {
                const recipe = findRecipeById(item.recipe_id);
                return (
                  <li
                    key={item.id}
                    className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {recipe ? (
                      <Link
                        to={`/receitas/${recipe.id}`}
                        className="flex items-center gap-2 text-sm hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        <span aria-hidden>🍳</span>
                        <span className="flex-1">{recipe.name}</span>
                        {item.quantity != null && (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className="text-sm text-zinc-400 line-through">
                        Receita não encontrada
                      </span>
                    )}
                  </li>
                );
              }
              if (item.kind === 'ingredient' && item.ingredient_id) {
                const ing = findIngredientById(item.ingredient_id);
                return (
                  <li
                    key={item.id}
                    className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {ing ? (
                      <Link
                        to={`/ingredientes/${ing.id}`}
                        className="flex items-center gap-2 text-sm hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        <span aria-hidden>🥕</span>
                        <span className="flex-1">{ing.brand ? `${ing.brand} — ${ing.name}` : ing.name}</span>
                        {item.quantity != null && (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span className="text-sm text-zinc-400 line-through">
                        Ingrediente não encontrado
                      </span>
                    )}
                  </li>
                );
              }
              return null;
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
