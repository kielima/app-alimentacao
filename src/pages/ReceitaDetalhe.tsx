import { useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import Icon from '../components/Icon';
import NutritionEstimate from '../components/NutritionEstimate';
import TrashIcon from '../components/TrashIcon';
import { isSeedRecipe } from '../data/recipes';
import { useRecipeCategories } from '../data/recipeCategories';
import { findIngredientById } from '../data/ingredients';
import { useRecipeNutrition } from '../hooks/useRecipeNutrition';
import { activeIngredient, recipeTotalWeightG } from '../utils/nutrition';
import { deleteUserRecipe, getUserRecipeById, upsertUserRecipe, useUserRecipes } from '../data/userRecipes';
import { hideRecipe } from '../data/hiddenRecipes';
import { upsertShoppingItem } from '../data/shoppingList';
import { usePantryItems } from '../data/pantry';
import { useAllMeals } from '../data/meals';
import { getMealSlots } from '../types/meal';
import type { MealItemRef } from '../types/meal';
import { MEAL_TYPES } from '../types/mealPlan';
import { recipeCategoryIds, type Recipe, type RecipeIngredient } from '../types/recipe';

export default function ReceitaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Assinatura reativa: alternar a alternativa ativa persiste e recalcula ao vivo.
  const userRecipes = useUserRecipes();
  const recipe = useMemo(
    () => (id ? userRecipes.find((r) => r.id === id) : undefined),
    [userRecipes, id],
  );
  const nutrition = useRecipeNutrition(recipe);
  const totalWeightG = useMemo(() => (recipe ? recipeTotalWeightG(recipe) : 0), [recipe]);
  const categories = useRecipeCategories();
  const pantryItems = usePantryItems();
  const pantryIngredientIds = useMemo(
    () => new Set(pantryItems.filter((p) => p.ingredient_id).map((p) => p.ingredient_id as string)),
    [pantryItems],
  );
  const allMeals = useAllMeals();
  const mealsUsingRecipe = useMemo(() => {
    if (!recipe) return [];
    const refMatches = (ref: MealItemRef) => ref.kind === 'recipe' && ref.recipe_id === recipe.id;
    return allMeals
      .filter((m) => m.items.some((it) => refMatches(it) || it.substitutes?.some(refMatches)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allMeals, recipe]);

  const isUserOverlay = id ? !!getUserRecipeById(id) : false;
  const isSeed = id ? isSeedRecipe(id) : false;
  const canRevert = id ? isUserOverlay && isSeed : false;

  const handleDelete = () => {
    if (!id) return;
    const msg = isSeed
      ? 'Apagar esta receita? (Receitas do livro original podem ser restauradas depois no fim da lista.)'
      : 'Apagar esta receita? Esta ação não pode ser desfeita.';
    if (!confirm(msg)) return;
    if (isUserOverlay) deleteUserRecipe(id);
    if (isSeed) hideRecipe(id);
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

  const handleSetActive = (
    section: 'main' | 'molho',
    itemIndex: number,
    activeIdx: number | null,
  ) => {
    if (!recipe) return;
    const key = section === 'molho' ? 'ingredients_molho' : 'ingredients';
    const list = [...(recipe[key] ?? [])];
    const item = list[itemIndex];
    if (!item) return;
    list[itemIndex] = { ...item, active_substitute: activeIdx };
    upsertUserRecipe({ ...recipe, [key]: list });
  };

  const handleAddSingleToCart = (item: RecipeIngredient) => {
    if (!recipe) return;
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
  };

  if (!recipe) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-12 text-center">
        <p className="mb-4 text-zinc-500 dark:text-zinc-400">Receita não encontrada.</p>
        <Link to="/receitas" className="text-brand-600 underline dark:text-brand-400">
          Voltar à lista
        </Link>
      </div>
    );
  }

  const recipeCats = recipeCategoryIds(recipe)
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is (typeof categories)[number] => c !== undefined);
  const category = recipeCats[0];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{recipe.name}</h1>
        {canRevert && (
          <button
            type="button"
            onClick={handleRevert}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            title="Descartar edições e voltar ao original"
          >
            <Icon name="rotate-ccw" className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
          aria-label="Excluir receita"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </HeaderSlot>

      {isUserOverlay && isSeedRecipe(recipe.id) && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-[11px] text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          <Icon name="pencil" className="h-3.5 w-3.5" /> Versão editada por você (sobrescreve o seed
          original)
        </div>
      )}

      <RecipePhoto photo={recipe.photos?.[0]} icon={category?.icon ?? 'utensils'} />

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {recipeCats.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1">
            <Icon name={c.icon} className="h-3.5 w-3.5" /> {c.name}
          </span>
        ))}
        {(recipe.meal_types ?? []).map((mt) => {
          const meta = MEAL_TYPES.find((m) => m.value === mt);
          if (!meta) return null;
          return (
            <span key={mt} className="inline-flex items-center gap-1">
              <Icon name={meta.icon} className="h-3.5 w-3.5" /> {meta.label}
            </span>
          );
        })}
        {recipe.prep_time_min && (
          <span className="inline-flex items-center gap-1">
            <Icon name="clock" className="h-3.5 w-3.5" /> {recipe.prep_time_min} min
          </span>
        )}
        {recipe.difficulty && (
          <span className="inline-flex items-center gap-1">
            <Icon name={difficultyIcon(recipe.difficulty)} className="h-3.5 w-3.5" />{' '}
            {difficultyLabel(recipe.difficulty)}
          </span>
        )}
        {recipe.season && (
          <span className="inline-flex items-center gap-1">
            <Icon name="sun" className="h-3.5 w-3.5" /> {seasonLabel(recipe.season)}
          </span>
        )}
        {recipe.rating && (
          <span
            className="inline-flex items-center text-amber-500"
            aria-label={`${recipe.rating} estrelas`}
          >
            {Array.from({ length: recipe.rating }).map((_, i) => (
              <Icon key={i} name="star" className="h-3.5 w-3.5" />
            ))}
          </span>
        )}
      </div>

      {recipe.needs_review && (
        <div className="mb-4 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
          <Icon name="alert-triangle" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Esta receita está em revisão. Ingredientes e modo de preparo ainda não foram totalmente
            estruturados a partir do livro de receitas.
          </span>
        </div>
      )}

      {recipe.notes && (
        <p className="mb-4 text-sm italic text-zinc-600 dark:text-zinc-300">{recipe.notes}</p>
      )}

      {(recipe.ingredients?.length ?? 0) > 0 && (
        <Section title="Ingredientes">
          <IngredientList
            items={recipe.ingredients ?? []}
            pantryIds={pantryIngredientIds}
            onAddToCart={handleAddSingleToCart}
            onSetActive={(itemIndex, activeIdx) => handleSetActive('main', itemIndex, activeIdx)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleAddToShoppingList(false)}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              <Icon name="shopping-cart" className="h-4 w-4" /> Adicionar todos à Lista
            </button>
            <button
              type="button"
              onClick={() => handleAddToShoppingList(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <Icon name="shopping-cart" className="h-4 w-4" /> Só os faltantes
            </button>
          </div>
        </Section>
      )}

      {(recipe.ingredients_molho?.length ?? 0) > 0 && (
        <Section title="Ingredientes — molho">
          <IngredientList
            items={recipe.ingredients_molho ?? []}
            pantryIds={pantryIngredientIds}
            onAddToCart={handleAddSingleToCart}
            onSetActive={(itemIndex, activeIdx) => handleSetActive('molho', itemIndex, activeIdx)}
          />
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

      <NutritionEstimate
        nutrition={nutrition}
        totalLabel="da receita inteira"
        totalWeightG={totalWeightG}
      />

      {mealsUsingRecipe.length > 0 && (
        <Section title={`Refeições com esta receita (${mealsUsingRecipe.length})`}>
          <ul className="space-y-1.5">
            {mealsUsingRecipe.map((m) => {
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

      <Link
        to={`/receitas/${recipe.id}/editar`}
        aria-label="Editar receita"
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

function RecipePhoto({ photo, icon }: { photo?: string; icon: string }) {
  const [failed, setFailed] = useState(false);
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt=""
        onError={() => setFailed(true)}
        className="mb-3 h-44 w-full rounded-xl object-cover"
      />
    );
  }
  return (
    <div
      className="mb-3 flex h-32 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800"
      aria-hidden
    >
      <Icon name={icon} className="h-16 w-16 text-zinc-400 dark:text-zinc-500" />
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

/** As opções de um ingrediente (principal + alternativas). Uma só se não houver. */
function optionsOf(item: RecipeIngredient): RecipeIngredient[] {
  if (!item.substitutes || item.substitutes.length === 0) return [item];
  const principal: RecipeIngredient = {
    ...item,
    substitutes: undefined,
    active_substitute: undefined,
  };
  return [principal, ...item.substitutes];
}

function activeIndexOf(item: RecipeIngredient): number {
  return item.active_substitute != null ? item.active_substitute + 1 : 0;
}

function IngredientList({
  items,
  pantryIds,
  onAddToCart,
  onSetActive,
}: {
  items: RecipeIngredient[];
  pantryIds: Set<string>;
  onAddToCart: (item: RecipeIngredient) => void;
  onSetActive: (itemIndex: number, activeIdx: number | null) => void;
}) {
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());
  const markAdded = (i: number) => setAddedIndices((s) => new Set(s).add(i));

  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => {
        const options = optionsOf(item);
        const hasSubs = options.length > 1;
        const activeIdx = activeIndexOf(item);

        // Ação (dispensa/carrinho) do lado direito de uma opção.
        const action = (opt: RecipeIngredient) => {
          const inPantry = !!opt.ingredient_id && pantryIds.has(opt.ingredient_id);
          if (inPantry) {
            return (
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center"
                title="Você já tem este ingrediente na dispensa"
                aria-label="Já tenho na dispensa"
                role="img"
              >
                <span className="block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
            );
          }
          const justAdded = addedIndices.has(i);
          return (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddToCart(opt);
                markAdded(i);
              }}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm leading-none transition-colors ${
                justAdded
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-brand-900/30 dark:hover:text-brand-400'
              }`}
              aria-label="Adicionar à lista de compras"
              title="Adicionar à lista de compras"
            >
              <Icon name={justAdded ? 'check' : 'shopping-cart'} className="h-4 w-4" />
            </button>
          );
        };

        // Caso simples: ingrediente sem alternativas (comportamento original).
        if (!hasSubs) {
          const ing = item.ingredient_id ? findIngredientById(item.ingredient_id) : undefined;
          const inner = (
            <span className="flex w-full items-center gap-2 text-sm">
              <span className="text-zinc-900 dark:text-zinc-100">{item.raw_text}</span>
              {item.is_optional && (
                <span className="shrink-0 text-xs italic text-zinc-400 dark:text-zinc-500">
                  (opcional)
                </span>
              )}
              {ing && (
                <span className="shrink-0 text-xs text-brand-600 dark:text-brand-400">›</span>
              )}
              <span className="ml-auto">{action(item)}</span>
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
        }

        // Ingrediente com alternativas: escolha "um OU outro".
        return (
          <li key={i} className="rounded-lg border border-zinc-200 dark:border-zinc-800">
            {item.is_optional && (
              <p className="px-2 pt-1.5 text-xs italic text-zinc-400 dark:text-zinc-500">
                (opcional)
              </p>
            )}
            <ul>
              {options.map((opt, oi) => {
                const ing = opt.ingredient_id ? findIngredientById(opt.ingredient_id) : undefined;
                const isActive = oi === activeIdx;
                const activate = () => onSetActive(i, oi === 0 ? null : oi - 1);
                return (
                  <li
                    key={oi}
                    className={`flex items-center gap-2 px-2 py-1.5 text-sm ${
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
                    {ing ? (
                      <Link
                        to={`/ingredientes/${ing.id}`}
                        className={`truncate hover:underline ${
                          isActive
                            ? 'text-zinc-900 dark:text-zinc-100'
                            : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {opt.raw_text}
                      </Link>
                    ) : (
                      <span
                        className={`truncate ${
                          isActive
                            ? 'text-zinc-900 dark:text-zinc-100'
                            : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {opt.raw_text}
                      </span>
                    )}
                    <span className="ml-auto shrink-0">{isActive && action(opt)}</span>
                  </li>
                );
              })}
            </ul>
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
  // Usa a opção em uso de cada ingrediente (principal ou alternativa escolhida).
  return [...(recipe.ingredients ?? []), ...(recipe.ingredients_molho ?? [])].map(activeIngredient);
}

function difficultyLabel(d: string): string {
  return { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' }[d] ?? d;
}

function difficultyIcon(d: string): string {
  return { facil: 'smile', medio: 'meh', dificil: 'flame' }[d] ?? 'smile';
}

function seasonLabel(s: string): string {
  return (
    { verao: 'Verão', outono: 'Outono', inverno: 'Inverno', primavera: 'Primavera' }[s] ?? s
  );
}
