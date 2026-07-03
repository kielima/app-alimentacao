import { useState } from 'react';
import { Link } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import Icon from '../components/Icon';
import { upsertUserIngredient } from '../data/userIngredients';
import { useDataGaps } from '../hooks/useDataGaps';
import type { Ingredient } from '../types/ingredient';

export default function Pendencias() {
  const gaps = useDataGaps();

  return (
    <div className="mx-auto max-w-md sm:max-w-2xl lg:max-w-3xl px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">Dados a completar</h1>
        {gaps.total > 0 && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {gaps.total}
          </span>
        )}
      </HeaderSlot>

      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Itens cujos dados faltam para o cálculo nutricional do plano funcionar. Preencha a porção
        padrão aqui mesmo; para tabela nutricional e quantidades, toque para abrir o item.
      </p>

      {gaps.total === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
          <Icon name="check-circle" className="mx-auto mb-2 h-7 w-7" />
          Tudo preenchido! Nenhum dado faltando para o cálculo nutricional.
        </div>
      ) : (
        <div className="space-y-6">
          <ServingGapSection ingredients={gaps.ingredientsNoServing} />

          <GapSection
            title="Ingredientes sem tabela nutricional"
            count={gaps.ingredientsNoNutrition.length}
            hint="Sem os valores por 100 g/ml não dá para calcular nada com este ingrediente."
            emptyWhenZero
          >
            {gaps.ingredientsNoNutrition.map((ing) => (
              <GapRow
                key={ing.id}
                to={`/ingredientes/${ing.id}/editar`}
                title={ing.brand ? `${ing.brand} — ${ing.name}` : ing.name}
                subtitle="Adicionar tabela nutricional"
              />
            ))}
          </GapSection>

          <GapSection
            title="Refeições com itens sem quantidade"
            count={gaps.mealGaps.length}
            hint="Itens sem quantidade não entram na soma da refeição."
            emptyWhenZero
          >
            {gaps.mealGaps.map(({ meal, missingCount }) => (
              <GapRow
                key={meal.id}
                to={`/refeicoes/${meal.id}/editar`}
                title={meal.name}
                subtitle={`${missingCount} ${missingCount === 1 ? 'item sem quantidade' : 'itens sem quantidade'}`}
              />
            ))}
          </GapSection>

          <GapSection
            title="Receitas com itens sem quantidade"
            count={gaps.recipeGaps.length}
            hint="Itens sem quantidade não entram no cálculo da receita."
            emptyWhenZero
          >
            {gaps.recipeGaps.map(({ recipe, missingCount }) => (
              <GapRow
                key={recipe.id}
                to={`/receitas/${recipe.id}/editar`}
                title={recipe.name}
                subtitle={`${missingCount} ${missingCount === 1 ? 'item sem quantidade' : 'itens sem quantidade'}`}
              />
            ))}
          </GapSection>
        </div>
      )}
    </div>
  );
}

function GapSection({
  title,
  count,
  hint,
  emptyWhenZero,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  emptyWhenZero?: boolean;
  children: React.ReactNode;
}) {
  if (emptyWhenZero && count === 0) return null;
  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {title}
        </h2>
        <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {count}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">{hint}</p>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

function GapRow({ to, title, subtitle }: { to: string; title: string; subtitle: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 hover:border-brand-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-500"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {title}
          </span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>
        </span>
        <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-zinc-400" />
      </Link>
    </li>
  );
}

function ServingGapSection({ ingredients }: { ingredients: Ingredient[] }) {
  if (ingredients.length === 0) return null;
  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Ingredientes sem porção padrão (g)
        </h2>
        <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {ingredients.length}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
        São usados em medidas como unidade/fatia. Informe quantas gramas tem 1 dessas medidas para
        o cálculo funcionar.
      </p>
      <ul className="space-y-1.5">
        {ingredients.map((ing) => (
          <ServingRow key={ing.id} ingredient={ing} />
        ))}
      </ul>
    </section>
  );
}

function ServingRow({ ingredient }: { ingredient: Ingredient }) {
  const unitSuffix = ingredient.default_unit === 'ml' ? 'ml' : 'g';
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  const parsed = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  const save = () => {
    if (!valid) return;
    upsertUserIngredient({ ...ingredient, serving_size_g: parsed });
    setSaved(true);
  };

  return (
    <li className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-2">
        <Link
          to={`/ingredientes/${ingredient.id}`}
          className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400"
        >
          {ingredient.brand ? `${ingredient.brand} — ${ingredient.name}` : ingredient.name}
        </Link>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Icon name="check" className="h-3.5 w-3.5" /> salvo
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">1 medida =</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="Ex.: 50"
          className="w-20 rounded-lg border border-zinc-300 bg-zinc-50 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
        />
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{unitSuffix}</span>
        <button
          type="button"
          onClick={save}
          disabled={!valid}
          className="ml-auto rounded-full bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Salvar
        </button>
      </div>
    </li>
  );
}
