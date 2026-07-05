import { useState } from 'react';
import { Link } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import FilterButton from '../components/FilterButton';
import CardActionSheet from '../components/CardActionSheet';
import TrashIcon from '../components/TrashIcon';
import Icon from '../components/Icon';
import { useHiddenSeedRecipes, allRecipeIds, useAllRecipes } from '../data/recipes';
import {
  useRecipeCategories,
  upsertRecipeCategory,
  deleteRecipeCategory,
  CATEGORY_ICON_OPTIONS,
  type RecipeCategory,
} from '../data/recipeCategories';
import { unhideRecipe } from '../data/hiddenRecipes';
import { upsertUserRecipe, deleteUserRecipe } from '../data/userRecipes';
import {
  useRecipes,
  type CompletenessFilter,
  type RatingFilter,
} from '../hooks/useRecipes';
import { useLongPress } from '../hooks/useLongPress';
import type { Recipe } from '../types/recipe';
import { uniqueSlug } from '../utils/slug';
import { downloadRecipesMarkdown } from '../utils/recipesMarkdown';

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
    categories,
    toggleCategory,
    completeness,
    setCompleteness,
    minRating,
    setMinRating,
    showFilters,
    setShowFilters,
    total,
  } = useRecipes();

  const cats = useRecipeCategories();
  const [manageCats, setManageCats] = useState(false);

  const [actionRecipeId, setActionRecipeId] = useState<string | null>(null);
  const actionRecipe = actionRecipeId
    ? list.find((r) => r.id === actionRecipeId) ?? null
    : null;

  const [exportedCount, setExportedCount] = useState<number | null>(null);

  const handleExportMarkdown = () => {
    // Exporta conforme o filtro ativo (ex.: só as categorias selecionadas).
    const count = downloadRecipesMarkdown(list);
    setExportedCount(count);
    setTimeout(() => setExportedCount(null), 4000);
  };

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

  const hasActiveFilters =
    categories.length > 0 || completeness !== 'todas' || minRating !== 0;
  const isFiltering = hasActiveFilters || !!query;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-2 pb-28">
      <HeaderSlot>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar receita…"
          className="h-9 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />
        <button
          type="button"
          onClick={handleExportMarkdown}
          disabled={list.length === 0}
          aria-label="Exportar receitas em Markdown"
          title={
            isFiltering
              ? 'Exportar as receitas filtradas (Markdown)'
              : 'Exportar todas as receitas (Markdown)'
          }
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-brand-400 dark:hover:text-brand-400"
        >
          <Icon name="download" className="h-4 w-4" />
        </button>
        <FilterButton
          active={showFilters}
          hasActiveFilters={hasActiveFilters}
          onClick={() => setShowFilters((f) => !f)}
        />
      </HeaderSlot>

      {exportedCount !== null && (
        <div className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          {exportedCount} receita{exportedCount !== 1 ? 's' : ''} exportada
          {exportedCount !== 1 ? 's' : ''} em Markdown.
        </div>
      )}

      {isFiltering && (
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          {list.length} de {total} receita{total !== 1 ? 's' : ''}
        </p>
      )}

      {showFilters && (
        <div className="sticky top-0 z-10 -mx-4 mb-3 bg-zinc-50/95 px-4 pb-2 pt-2 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/80">
          <div className="mb-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Categoria
              </p>
              <button
                type="button"
                onClick={() => setManageCats((m) => !m)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  manageCats
                    ? 'bg-brand-500 text-white dark:bg-brand-600'
                    : 'text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30'
                }`}
              >
                <Icon name={manageCats ? 'check' : 'pencil'} className="h-3 w-3" />
                {manageCats ? 'Concluir' : 'Gerenciar'}
              </button>
            </div>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {cats.map((c) => (
                <Chip
                  key={c.id}
                  active={categories.includes(c.id)}
                  onClick={() => toggleCategory(c.id)}
                >
                  <Icon name={c.icon} className="h-3.5 w-3.5" /> {c.name}
                </Chip>
              ))}
            </div>
            {manageCats && <CategoryManager cats={cats} />}
          </div>
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
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {list.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              category={cats.find((c) => c.id === r.category)}
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

function RecipeCard({
  recipe,
  category: cat,
  onLongPress,
}: {
  recipe: Recipe;
  category: RecipeCategory | undefined;
  onLongPress: () => void;
}) {
  const longPress = useLongPress(onLongPress, { delay: 450 });
  const [imgFailed, setImgFailed] = useState(false);
  const photo = recipe.photos?.[0];
  return (
    <li>
      <Link
        to={`/receitas/${recipe.id}`}
        {...longPress}
        className="group flex h-full select-none flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-colors hover:border-brand-500 [-webkit-touch-callout:none] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-400"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {photo && !imgFailed ? (
            <img
              src={photo}
              alt=""
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center" aria-hidden>
              <Icon
                name={cat?.icon ?? 'utensils'}
                className="h-10 w-10 text-zinc-300 dark:text-zinc-600"
              />
            </div>
          )}
          {recipe.needs_review && (
            <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-100/95 px-2 py-0.5 text-[10px] font-medium text-amber-700 shadow-sm backdrop-blur-sm dark:bg-amber-900/70 dark:text-amber-200">
              revisar
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-2.5">
          <p className="line-clamp-2 text-sm font-medium leading-tight">{recipe.name}</p>
          <p className="mt-1 inline-flex flex-wrap items-center gap-x-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="truncate">{cat?.name ?? 'Sem categoria'}</span>
            {recipe.prep_time_min ? (
              <span className="inline-flex items-center gap-0.5">
                · <Icon name="clock" className="h-3.5 w-3.5" /> {recipe.prep_time_min}min
              </span>
            ) : null}
          </p>
          <div className="mt-auto flex items-center gap-1 pt-1">
            {recipe.rating ? (
              <span
                className="inline-flex items-center text-amber-500"
                aria-label={`${recipe.rating} estrelas`}
              >
                {Array.from({ length: recipe.rating }).map((_, i) => (
                  <Icon key={i} name="star" className="h-3.5 w-3.5" />
                ))}
              </span>
            ) : null}
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

function CategoryManager({ cats }: { cats: RecipeCategory[] }) {
  const recipes = useAllRecipes();
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(CATEGORY_ICON_OPTIONS[0]);
  // Qual linha está com o seletor de ícone aberto ('__new__' = linha de adição).
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);

  const countIn = (id: string) => recipes.filter((r) => r.category === id).length;

  const addCategory = () => {
    const name = newName.trim();
    if (!name) return;
    const id = uniqueSlug(name, new Set(cats.map((c) => c.id)));
    upsertRecipeCategory({ id, name, icon: newIcon, order: cats.length });
    setNewName('');
    setNewIcon(CATEGORY_ICON_OPTIONS[0]);
    setIconPickerFor(null);
  };

  const renameCategory = (cat: RecipeCategory, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === cat.name) return;
    upsertRecipeCategory({ ...cat, name: trimmed });
  };

  const changeIcon = (cat: RecipeCategory, icon: string) => {
    upsertRecipeCategory({ ...cat, icon });
    setIconPickerFor(null);
  };

  const removeCategory = (cat: RecipeCategory) => {
    const n = countIn(cat.id);
    const warn =
      n > 0
        ? `Apagar a categoria "${cat.name}"? ${n} receita(s) ficarão sem categoria.`
        : `Apagar a categoria "${cat.name}"?`;
    if (!confirm(warn)) return;
    deleteRecipeCategory(cat.id);
  };

  return (
    <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <ul className="space-y-1.5">
        {cats.map((cat) => (
          <li key={cat.id}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIconPickerFor((f) => (f === cat.id ? null : cat.id))}
                aria-label={`Trocar ícone de ${cat.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-brand-900/30 dark:hover:text-brand-400"
              >
                <Icon name={cat.icon} className="h-4 w-4" />
              </button>
              <input
                key={`${cat.id}-${cat.name}`}
                defaultValue={cat.name}
                onBlur={(e) => renameCategory(cat, e.target.value)}
                className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
              />
              <button
                type="button"
                onClick={() => removeCategory(cat)}
                aria-label={`Apagar categoria ${cat.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            {iconPickerFor === cat.id && (
              <IconGrid selected={cat.icon} onPick={(icon) => changeIcon(cat, icon)} />
            )}
          </li>
        ))}
      </ul>

      <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIconPickerFor((f) => (f === '__new__' ? null : '__new__'))}
            aria-label="Escolher ícone da nova categoria"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-brand-900/30 dark:hover:text-brand-400"
          >
            <Icon name={newIcon} className="h-4 w-4" />
          </button>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCategory();
              }
            }}
            placeholder="Nova categoria…"
            className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={addCategory}
            disabled={!newName.trim()}
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-brand-500 px-2.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-40 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <Icon name="plus" className="h-4 w-4" /> Adicionar
          </button>
        </div>
        {iconPickerFor === '__new__' && (
          <IconGrid
            selected={newIcon}
            onPick={(icon) => {
              setNewIcon(icon);
              setIconPickerFor(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function IconGrid({ selected, onPick }: { selected: string; onPick: (icon: string) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1 rounded-lg bg-zinc-50 p-1.5 dark:bg-zinc-800/50">
      {CATEGORY_ICON_OPTIONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onPick(icon)}
          aria-label={`Ícone ${icon}`}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            selected === icon
              ? 'bg-brand-500 text-white dark:bg-brand-600'
              : 'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700'
          }`}
        >
          <Icon name={icon} className="h-4 w-4" />
        </button>
      ))}
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
