import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HeaderSlot from '../components/HeaderSlot';
import ScanButton from '../components/ScanButton';
import FilterButton from '../components/FilterButton';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import CardActionSheet from '../components/CardActionSheet';
import TrashIcon from '../components/TrashIcon';
import Icon from '../components/Icon';
import {
  useIngredients,
  ingredientNeedsReview,
  type IngredientFilter,
} from '../hooks/useIngredients';
import { useLongPress } from '../hooks/useLongPress';
import {
  upsertShoppingItem,
  deleteShoppingItem,
  useShoppingItems,
} from '../data/shoppingList';
import {
  upsertPantryItem,
  deletePantryItem,
  usePantryItems,
} from '../data/pantry';
import { useAllIngredients, allIngredientIds } from '../data/ingredients';
import {
  upsertUserIngredient,
  deleteUserIngredient,
} from '../data/userIngredients';
import { handleScanForIngredientsList } from '../lib/scanActions';
import type { Ingredient } from '../types/ingredient';
import { uniqueSlug } from '../utils/slug';

const filters: { value: IngredientFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'marcas', label: 'Marcas' },
  { value: 'genericos', label: 'Genéricos' },
  { value: 'a-verificar', label: 'A verificar' },
  { value: 'revisar', label: 'Revisar' },
];

export default function Ingredientes() {
  const navigate = useNavigate();
  const shoppingItems = useShoppingItems();
  const pantryItems = usePantryItems();
  const allIngredients = useAllIngredients();
  const [scanOpen, setScanOpen] = useState(false);

  const listedIngredientIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of shoppingItems) {
      if (item.ingredient_id) set.add(item.ingredient_id);
    }
    for (const item of pantryItems) {
      if (item.ingredient_id) set.add(item.ingredient_id);
    }
    return set;
  }, [shoppingItems, pantryItems]);

  const {
    list,
    query,
    setQuery,
    filter,
    setFilter,
    showFilters,
    setShowFilters,
    total,
  } = useIngredients({ listedIngredientIds });

  const hasActiveFilters = filter !== 'todos';
  const isFiltering = hasActiveFilters || !!query.trim();

  const [actionIngredientId, setActionIngredientId] = useState<string | null>(null);
  const actionIngredient = actionIngredientId
    ? list.find((i) => i.id === actionIngredientId) ?? null
    : null;

  const duplicateIngredient = (ingredient: Ingredient) => {
    const baseName = ingredient.brand
      ? `${ingredient.brand} — ${ingredient.name} (cópia)`
      : `${ingredient.name} (cópia)`;
    const newId = uniqueSlug(baseName, allIngredientIds());
    upsertUserIngredient({
      ...ingredient,
      id: newId,
      name: `${ingredient.name} (cópia)`,
    });
    setActionIngredientId(null);
  };

  const deleteIngredient = (ingredient: Ingredient) => {
    if (!confirm(`Apagar o ingrediente "${ingredient.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    deleteUserIngredient(ingredient.id);
    setActionIngredientId(null);
  };

  const cartByIngredient = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of shoppingItems) {
      if (!item.ingredient_id) continue;
      const ids = map.get(item.ingredient_id) ?? [];
      ids.push(item.id);
      map.set(item.ingredient_id, ids);
    }
    return map;
  }, [shoppingItems]);

  const pantryByIngredient = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of pantryItems) {
      if (!item.ingredient_id) continue;
      const ids = map.get(item.ingredient_id) ?? [];
      ids.push(item.id);
      map.set(item.ingredient_id, ids);
    }
    return map;
  }, [pantryItems]);

  const handleToggleCart = (ing: Ingredient) => {
    const existing = cartByIngredient.get(ing.id);
    if (existing && existing.length > 0) {
      existing.forEach((id) => deleteShoppingItem(id));
      return;
    }
    upsertShoppingItem({
      id: `from-ingredient-${ing.id}-${Date.now()}`,
      ingredient_id: ing.id,
      raw_text: ing.name,
      quantity: null,
      unit: ing.default_unit ?? null,
      store: null,
      price: null,
      checked: false,
      source: 'manual',
      source_ref: ing.id,
      added_at: new Date().toISOString(),
    });
  };

  const handleTogglePantry = (ing: Ingredient) => {
    const existing = pantryByIngredient.get(ing.id);
    if (existing && existing.length > 0) {
      existing.forEach((id) => deletePantryItem(id));
      return;
    }
    upsertPantryItem({
      id: `from-ingredient-${ing.id}-${Date.now()}`,
      ingredient_id: ing.id,
      raw_text: ing.name,
      quantity: null,
      unit: ing.default_unit ?? null,
      expiry_date: null,
      store: null,
      added_at: new Date().toISOString(),
    });
  };

  return (
    <div className="mx-auto max-w-md sm:max-w-2xl lg:max-w-3xl px-4 pt-2">
      <HeaderSlot>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ingrediente…"
          className="h-9 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder:text-zinc-500"
        />
        <ScanButton onClick={() => setScanOpen(true)} />
        <FilterButton
          active={showFilters}
          hasActiveFilters={hasActiveFilters}
          onClick={() => setShowFilters((f) => !f)}
        />
      </HeaderSlot>

      <BarcodeScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        actions={['create-ingredient', 'manual-not-found']}
        onPick={(result, action) => {
          setScanOpen(false);
          handleScanForIngredientsList(result, action, allIngredients, navigate);
        }}
      />

      {isFiltering && (
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">
          {list.length} de {total} ingrediente{total !== 1 ? 's' : ''}
        </p>
      )}

      {showFilters && (
        <div className="sticky top-0 z-10 -mx-4 mb-3 bg-zinc-50/95 px-4 pb-2 pt-2 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80 dark:bg-zinc-950/95 dark:supports-[backdrop-filter]:bg-zinc-950/80">
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f.value
                    ? 'bg-brand-500 text-white dark:bg-brand-600'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Link
        to="/ingredientes/novo"
        aria-label="Novo ingrediente"
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

      {list.length === 0 ? (
        <p className="mt-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nenhum ingrediente encontrado.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((ing) => (
            <IngredientCard
              key={ing.id}
              ingredient={ing}
              addedToCart={(cartByIngredient.get(ing.id)?.length ?? 0) > 0}
              addedToPantry={(pantryByIngredient.get(ing.id)?.length ?? 0) > 0}
              onToggleCart={() => handleToggleCart(ing)}
              onTogglePantry={() => handleTogglePantry(ing)}
              onLongPress={() => setActionIngredientId(ing.id)}
            />
          ))}
        </ul>
      )}

      {actionIngredient && (
        <CardActionSheet
          category="Ingrediente"
          title={actionIngredient.brand ? `${actionIngredient.brand} — ${actionIngredient.name}` : actionIngredient.name}
          onClose={() => setActionIngredientId(null)}
          actions={[
            {
              label: 'Duplicar ingrediente',
              icon: <Icon name="clipboard" className="h-4 w-4" />,
              onClick: () => duplicateIngredient(actionIngredient),
            },
            {
              label: 'Apagar ingrediente',
              icon: <TrashIcon className="h-4 w-4" />,
              onClick: () => deleteIngredient(actionIngredient),
              destructive: true,
            },
          ]}
        />
      )}
    </div>
  );
}

interface IngredientCardProps {
  ingredient: Ingredient;
  addedToCart: boolean;
  addedToPantry: boolean;
  onToggleCart: () => void;
  onTogglePantry: () => void;
  onLongPress: () => void;
}

function IngredientCard({
  ingredient: ing,
  addedToCart,
  addedToPantry,
  onToggleCart,
  onTogglePantry,
  onLongPress,
}: IngredientCardProps) {
  const longPress = useLongPress(onLongPress, { delay: 450 });
  // Impede que tocar nos botões internos (carrinho/dispensa) inicie o long-press do card.
  const stopGesture = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };
  return (
    <li>
      <Link
        to={`/ingredientes/${ing.id}`}
        {...longPress}
        className="flex select-none items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-brand-500 [-webkit-touch-callout:none] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-400"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{ing.name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {ing.brand ? `${ing.brand} · ` : ''}
            {ing.nutrition_per_100
              ? `${ing.nutrition_per_100.calories} kcal/100${ing.default_unit === 'ml' ? 'ml' : 'g'}`
              : 'sem dados nutricionais'}
          </p>
        </div>
        {ingredientNeedsReview(ing) && (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            title={
              ing.category === 'hortifruti' && !ing.ceagesp_slug
                ? 'Hortifruti sem link do CEAGESP'
                : 'Valores nutricionais ainda precisam validação'
            }
          >
            revisar
          </span>
        )}
        <button
          type="button"
          {...stopGesture}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePantry();
          }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm leading-none transition-colors ${
            addedToPantry
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-zinc-100 text-zinc-500 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-brand-900/30 dark:hover:text-brand-400'
          }`}
          aria-label={addedToPantry ? 'Remover da dispensa' : 'Adicionar à dispensa'}
          title={addedToPantry ? 'Remover da dispensa' : 'Adicionar à dispensa'}
        >
          {addedToPantry ? (
            <Icon name="check" className="h-4 w-4" />
          ) : (
            <Icon name="can" className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          {...stopGesture}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleCart();
          }}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm leading-none transition-colors ${
            addedToCart
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-zinc-100 text-zinc-500 hover:bg-brand-50 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-brand-900/30 dark:hover:text-brand-400'
          }`}
          aria-label={addedToCart ? 'Remover da lista de compras' : 'Adicionar à lista de compras'}
          title={addedToCart ? 'Remover da lista de compras' : 'Adicionar à lista de compras'}
        >
          {addedToCart ? (
            <Icon name="check" className="h-4 w-4" />
          ) : (
            <Icon name="shopping-cart" className="h-4 w-4" />
          )}
        </button>
        <span className="text-zinc-400" aria-hidden>
          ›
        </span>
      </Link>
    </li>
  );
}
