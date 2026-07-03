import { useState } from 'react';
import { Link } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import FilterButton from '../components/FilterButton';
import CardActionSheet from '../components/CardActionSheet';
import TrashIcon from '../components/TrashIcon';
import Icon from '../components/Icon';
import { recipeCategories, useHiddenSeedRecipes, allRecipeIds } from '../data/recipes';
import { unhideRecipe } from '../data/hiddenRecipes';
import { upsertUserRecipe, deleteUserRecipe } from '../data/userRecipes';
import {
  useRecipes,
  type CompletenessFilter,
  type RatingFilter,
} from '../hooks/useRecipes';
import { useLongPress } from '../hooks/useLongPress';
import type { Recipe, RecipeCategoryId } from '../types/recipe';
import { uniqueSlug } from '../utils/slug';

const categoryChips: { value: RecipeCategoryId | 'todas'; label: string; icon: string }[] = [
  { value: 'todas', label: 'Todas', icon: 'sparkles' },
  ...recipeCategories.map((c) => ({ value: c.id, label: c.name, icon: c.icon })),
];

const completenessChips: { value: CompletenessFilter; label: string }[] = [
  { value: 'todas', label: 'Tudo' },
  { value: 'completas', label: 'Completas' },
  { value: 'revisao', label: 'Em revisão' },
];

const ratingChips: { value: RatingFilter; label: string; star?: boolean }[] = [
  { value: 0, label: 'Qualquer' },
  { value: 3, label: '3+', star: true },
  { value: 4, label: '4+', star: true },
  { value: 5, label: '5', star: true },
];

export default function Receitas() {
  const {
    list,
    query,
    setQuery,
    category,
    setCategory,
    completeness,
    setCompleteness,
    minRating,
    setMinRating,
    showFilters,
    setShowFilters,
    total,
  } = useRecipes();

  const [actionRecipeId, setActionRecipeId] = useState<string | null>(null);
  const actionRecipe = actionRecipeId
    ? list.find((r) => r.id === actionRecipeId) ?? null
    : null;

  const duplicateRecipe = (recipe: Recipe) => {
    const baseName = `${recipe.name} (cópia)`;
    const newId = uniqueSlug(baseName, allRecipeIds());
    const cloned: Recipe = { ...recipe, id: newId, name: baseName };
    upsertUserRecipe(cloned);
    setActionRecipeId(null);
  };

  const deleteRecipe = (recipe: Recipe) => {
    if (!confirm(`Apagar a receita "${recipe.name}"? Esta ação não pode ser desfeita.`)) return;
    deleteUserRecipe(recipe.id);
    setActionRecipeId(null);
  };

  const hasActiveFilters = category !== 'todas' || completeness !== 'todas' || minRating !== 0;
  const isFiltering = hasActiveFilters || !!query;

  return (
    <div className="mx-auto max-w-md sm:max-w-2xl lg:max-w-3xl px-4 pt-2 pb-28">
      <HeaderSlot>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar receita…"
          className="h-9 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />
        <FilterButton
          active={showFilters}
          hasActiveFilters={hasActiveFilters}
          onClick={() => setShowFilters((f) => !f)}
        />
      </HeaderSlot>

      {isFiltering && (
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          {list.length} de {total} receita{total !== 1 ? 's' : ''}
        </p>
      )}

      {showFilters && (
        <div className="sticky top-0 z-10 -mx-4 mb-3 bg-zinc-50/95 px-4 pb-2 pt-2 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/80">
          <FilterRow label="Categoria">
            {categoryChips.map((c) => (
              <Chip key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
                <Icon name={c.icon} className="h-3.5 w-3.5" /> {c.label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Status">
            {completenessChips.map((c) => (
              <Chip
                key={c.value}
                active={completeness === c.value}
                onClick={() => setCompleteness(c.value)}
              >
                {c.label}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Avaliação">
            {ratingChips.map((r) => (
              <Chip key={r.value} active={minRating === r.value} onClick={() => setMinRating(r.value)}>
                {r.star && <Icon name="star" className="h-3.5 w-3.5 text-amber-500" />} {r.label}
              </Chip>
            ))}
          </FilterRow>
        </div>
      )}

      {list.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nenhuma receita encontrada com esses filtros.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onLongPress={() => setActionRecipeId(r.id)}
            />
          ))}
        </ul>
      )}

      {actionRecipe && (
        <CardActionSheet
          category="Receita"
          title={actionRecipe.name}
          onClose={() => setActionRecipeId(null)}
          actions={[
            {
              label: 'Duplicar receita',
              icon: <Icon name="clipboard" className="h-4 w-4" />,
              onClick: () => duplicateRecipe(actionRecipe),
            },
            {
              label: 'Apagar receita',
              icon: <TrashIcon className="h-4 w-4" />,
              onClick: () => deleteRecipe(actionRecipe),
              destructive: true,
            },
          ]}
        />
      )}

      <HiddenRecipesPanel />

      <Link
        to="/receitas/importar"
        aria-label="Importar receita de um link"
        title="Importar de link (TikTok, YouTube, Instagram, web)"
        className="fixed bottom-20 right-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        <Icon name="sparkles" className="h-6 w-6" />
      </Link>

      <Link
        to="/receitas/nova"
        aria-label="Nova receita"
        className="fixed bottom-4 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-brand-cream text-brand-700 shadow-lg hover:bg-brand-100 dark:bg-brand-cream dark:text-brand-700 dark:hover:bg-brand-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="h-7 w-7"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
    </div>
  );
}

function RecipeCard({ recipe, onLongPress }: { recipe: Recipe; onLongPress: () => void }) {
  const longPress = useLongPress(onLongPress, { delay: 450 });
  const cat = recipeCategories.find((c) => c.id === recipe.category);
  const [imgFailed, setImgFailed] = useState(false);
  const photo = recipe.photos?.[0];
  return (
    <li>
      <Link
        to={`/receitas/${recipe.id}`}
        {...longPress}
        className="flex select-none items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-brand-500 [-webkit-touch-callout:none] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-400"
      >
        {photo && !imgFailed ? (
          <img
            src={photo}
            alt=""
            onError={() => setImgFailed(true)}
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800"
            aria-hidden
          >
            <Icon name={cat?.icon ?? 'utensils'} className="h-7 w-7" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{recipe.name}</p>
          <p className="mt-0.5 inline-flex flex-wrap items-center gap-x-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{cat?.name}</span>
            {recipe.prep_time_min ? (
              <span className="inline-flex items-center gap-0.5">
                · <Icon name="clock" className="h-3.5 w-3.5" /> {recipe.prep_time_min}min
              </span>
            ) : null}
          </p>
          <div className="mt-1 flex items-center gap-1">
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
            {recipe.needs_review && (
              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                revisar
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

function HiddenRecipesPanel() {
  const hidden = useHiddenSeedRecipes();
  const [open, setOpen] = useState(false);
  if (hidden.length === 0) return null;
  return (
    <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
      >
        <Icon name={open ? 'chevron-down' : 'chevron-right'} className="h-3.5 w-3.5" />{' '}
        {hidden.length} receita(s) oculta(s)
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {hidden.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900"
            >
              <span className="flex-1 truncate text-zinc-500 line-through dark:text-zinc-400">
                {r.name}
              </span>
              <button
                type="button"
                onClick={() => unhideRecipe(r.id)}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-brand-900/30 dark:hover:text-brand-400"
                aria-label={`Restaurar ${r.name}`}
              >
                <Icon name="rotate-ccw" className="h-3.5 w-3.5" /> restaurar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-brand-500 text-white dark:bg-brand-600'
          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
      }`}
    >
      {children}
    </button>
  );
}
