import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { findRecipeById, findCategory, isSeedRecipe } from '../data/recipes';
import { findIngredientById } from '../data/ingredients';
import { useRecipeNutrition } from '../hooks/useRecipeNutrition';
import { deleteUserRecipe, getUserRecipeById } from '../data/userRecipes';
import { upsertShoppingItem } from '../data/shoppingList';
import { getPantry } from '../data/pantry';
import type { Recipe, RecipeIngredient } from '../types/recipe';

function fmt(value: number | undefined, digits = 0): string {
  if (value === undefined) return '—';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

export default function ReceitaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recipe = id ? findRecipeById(id) : undefined;
  const nutrition = useRecipeNutrition(recipe);
  const [showSkipped, setShowSkipped] = useState(false);

  const isUserOverlay = id ? !!getUserRecipeById(id) : false;
  const canDelete = id ? isUserOverlay && !isSeedRecipe(id) : false;
  const canRevert = id ? isUserOverlay && isSeedRecipe(id) : false;

  const handleDelete = () => {
    if (!id) return;
    if (!confirm('Excluir esta receita?')) return;
    deleteUserRecipe(id);
    navigate('/receitas');
  };

  const handleRevert = () => {
    if (!id) return;
    if (!confirm('Descartar suas edições e voltar à versão original?')) return;
    deleteUserRecipe(id);
    navigate(`/receitas/${id}`);
  };

  const handleAddToShoppingList = (onlyMissing: boolean) => {
    if (!recipe) return;
    const items = collectAllIngredients(recipe);
    if (items.length === 0) {
      alert('Esta receita não tem ingredientes cadastrados.');
      return;
    }
    const pantryIngredientIds = new Set(
      getPantry()
        .map((p) => p.ingredient_id)
        .filter((x): x is string => !!x),
    );
    const toAdd = onlyMissing
      ? items.filter((i) => !i.ingredient_id || !pantryIngredientIds.has(i.ingredient_id))
      : items;
    if (toAdd.length === 0) {
      alert('Você já tem todos os ingredientes desta receita na dispensa.');
      return;
    }
    for (const item of toAdd) {
      upsertShoppingItem({
        id: `from-recipe-${recipe.id}-${Math.random().toString(36).slice(2, 9)}`,
        ingredient_id: item.ingredient_id,
        raw_text: item.raw_text,
        quantity: item.quantity,
        unit: item.unit,
        store: null,
        price: null,
        checked: false,
        source: 'from_recipe',
        source_ref: recipe.id,
        added_at: new Date().toISOString(),
      });
    }
    if (confirm(`${toAdd.length} item(ns) adicionado(s) à Lista de Compras. Ir para a lista agora?`)) {
      navigate('/compras');
    }
  };

  if (!recipe) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Receita não encontrada.</p>
        <Link to="/receitas" className="text-brand-600 underline dark:text-brand-400">
          Voltar à lista
        </Link>
      </div>
    );
  }

  const category = findCategory(recipe.category);

  return (
    <div className="mx-auto max-w-md px-4 pt-2 pb-6">
      <div className="mb-3 flex items-center gap-2">
        <Link
          to="/receitas"
          className="rounded-full bg-zinc-200/60 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
          aria-label="Voltar"
        >
          ←
        </Link>
        <h1 className="flex-1 truncate text-lg font-semibold">{recipe.name}</h1>
        <Link
          to={`/receitas/${recipe.id}/editar`}
          className="rounded-full bg-zinc-200/60 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
          aria-label="Editar receita"
        >
          ✏️
        </Link>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-full bg-zinc-200/60 px-3 py-1 text-sm text-zinc-700 hover:bg-red-100 hover:text-red-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-red-900/30 dark:hover:text-red-300"
            aria-label="Excluir receita"
          >
            🗑️
          </button>
        )}
        {canRevert && (
          <button
            type="button"
            onClick={handleRevert}
            className="rounded-full bg-zinc-200/60 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
            title="Descartar edições e voltar ao original"
          >
            ↺
          </button>
        )}
      </div>

      {isUserOverlay && isSeedRecipe(recipe.id) && (
        <div className="mb-3 rounded-lg bg-brand-50 px-3 py-1.5 text-[11px] text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          ✏️ Versão editada por você (sobrescreve o seed original)
        </div>
      )}

      <div
        className="mb-3 flex h-32 items-center justify-center rounded-xl bg-zinc-100 text-6xl dark:bg-zinc-800"
        aria-hidden
      >
        {category?.icon ?? '🍽️'}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {category && (
          <span>
            {category.icon} {category.name}
          </span>
        )}
        {recipe.prep_time_min && <span>⏱ {recipe.prep_time_min} min</span>}
        {recipe.difficulty && <span>{difficultyLabel(recipe.difficulty)}</span>}
        {recipe.season && <span>☀️ {seasonLabel(recipe.season)}</span>}
        {recipe.rating && (
          <span className="text-amber-500" aria-label={`${recipe.rating} estrelas`}>
            {'⭐'.repeat(recipe.rating)}
          </span>
        )}
      </div>

      {recipe.needs_review && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
          ⚠️ Esta receita está em revisão. Ingredientes e modo de preparo ainda não foram totalmente
          estruturados a partir do livro de receitas.
        </div>
      )}

      {recipe.notes && (
        <p className="mb-4 text-sm italic text-zinc-600 dark:text-zinc-300">{recipe.notes}</p>
      )}

      {(recipe.ingredients?.length ?? 0) > 0 && (
        <Section title="Ingredientes">
          <IngredientList items={recipe.ingredients ?? []} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleAddToShoppingList(false)}
              className="rounded-full bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              🛒 Adicionar todos à Lista
            </button>
            <button
              type="button"
              onClick={() => handleAddToShoppingList(true)}
              className="rounded-full bg-zinc-200/60 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
            >
              🛒 Só os faltantes
            </button>
          </div>
        </Section>
      )}

      {(recipe.ingredients_molho?.length ?? 0) > 0 && (
        <Section title="Ingredientes — molho">
          <IngredientList items={recipe.ingredients_molho ?? []} />
        </Section>
      )}

      {(recipe.steps?.length ?? 0) > 0 && (
        <Section title="Modo de preparo">
          <Steps steps={recipe.steps ?? []} />
        </Section>
      )}

      {(recipe.steps_natural?.length ?? 0) > 0 && (
        <Section title="Modo de preparo — natural">
          <Steps steps={recipe.steps_natural ?? []} />
        </Section>
      )}

      {(recipe.steps_congelada?.length ?? 0) > 0 && (
        <Section title="Modo de preparo — congelada">
          <Steps steps={recipe.steps_congelada ?? []} />
        </Section>
      )}

      {nutrition && nutrition.counted > 0 && (
        <Section title="Nutrição (estimada)">
          <table className="w-full text-sm">
            <tbody>
              {[
                { key: 'calories', label: 'Calorias', unit: 'kcal' },
                { key: 'protein', label: 'Proteínas', unit: 'g' },
                { key: 'carbs', label: 'Carboidratos', unit: 'g' },
                { key: 'fat', label: 'Gorduras', unit: 'g' },
                { key: 'fiber', label: 'Fibras', unit: 'g' },
                { key: 'sodium', label: 'Sódio', unit: 'mg' },
              ].map(({ key, label, unit }) => (
                <tr
                  key={key}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="py-1.5 text-zinc-600 dark:text-zinc-300">{label}</td>
                  <td className="py-1.5 text-right font-medium">
                    {fmt(nutrition.totals[key as keyof typeof nutrition.totals], 1)} {unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            Total da receita inteira somando {nutrition.counted} ingrediente(s) com dados.
            {nutrition.skipped > 0 && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => setShowSkipped((s) => !s)}
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  {showSkipped ? '▾' : '▸'} {nutrition.skipped} ignorado(s)
                </button>
              </>
            )}
          </p>
          {showSkipped && nutrition.skipped > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {nutrition.skippedReasons.map((s, i) => (
                <li key={i}>
                  <span className="text-zinc-700 dark:text-zinc-300">{s.raw}</span> — {s.reason}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {(recipe.ingredients?.length ?? 0) === 0 &&
        (recipe.ingredients_molho?.length ?? 0) === 0 &&
        (recipe.steps?.length ?? 0) === 0 &&
        (recipe.steps_natural?.length ?? 0) === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Sem ingredientes ou modo de preparo cadastrados ainda. Veja a fonte original no markdown
            (linhas {recipe.source_lines[0]}–{recipe.source_lines[1]}).
          </p>
        )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function IngredientList({ items }: { items: RecipeIngredient[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => {
        const ing = item.ingredient_id ? findIngredientById(item.ingredient_id) : undefined;
        const inner = (
          <span className="flex items-baseline gap-2 text-sm">
            <span className="text-zinc-900 dark:text-zinc-100">{item.raw_text}</span>
            {ing && (
              <span className="ml-auto shrink-0 text-xs text-brand-600 dark:text-brand-400">›</span>
            )}
          </span>
        );
        return (
          <li key={i}>
            {ing ? (
              <Link
                to={`/ingredientes/${ing.id}`}
                className="flex items-center rounded-md px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {inner}
              </Link>
            ) : (
              <div className="px-2 py-1">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2.5 text-sm">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
            aria-hidden
          >
            {i + 1}
          </span>
          <span className="text-zinc-700 dark:text-zinc-200">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function collectAllIngredients(recipe: Recipe): RecipeIngredient[] {
  return [...(recipe.ingredients ?? []), ...(recipe.ingredients_molho ?? [])];
}

function difficultyLabel(d: string): string {
  return { facil: '😌 Fácil', medio: '😅 Médio', dificil: '🔥 Difícil' }[d] ?? d;
}

function seasonLabel(s: string): string {
  return (
    { verao: 'Verão', outono: 'Outono', inverno: 'Inverno', primavera: 'Primavera' }[s] ?? s
  );
}
