import { useEffect } from 'react';
import { createFirestoreStore } from '../utils/createFirestoreStore';
import type { RecipeCategoryDef } from '../types/recipe';

export type RecipeCategory = RecipeCategoryDef;

/**
 * Categorias semeadas por padrão para novos usuários. São gravadas no Firestore
 * do usuário na primeira vez e, a partir daí, ficam totalmente editáveis e
 * apagáveis como qualquer categoria criada por ele.
 */
export const DEFAULT_RECIPE_CATEGORIES: RecipeCategory[] = [
  { id: 'pratos-principais', name: 'Pratos Principais', icon: 'utensils', order: 0 },
  { id: 'bebidas', name: 'Bebidas', icon: 'cup-soda', order: 1 },
  { id: 'sobremesas-e-lanches', name: 'Sobremesas e Lanches', icon: 'cake', order: 2 },
  {
    id: 'molhos-temperos-acompanhamentos',
    name: 'Molhos, Temperos e Acompanhamentos',
    icon: 'soup',
    order: 3,
  },
];

/** Ícones sugeridos para categorias (subconjunto do componente <Icon />). */
export const CATEGORY_ICON_OPTIONS: string[] = [
  'utensils',
  'utensils-crossed',
  'cup-soda',
  'coffee',
  'cake',
  'soup',
  'salad',
  'sandwich',
  'carrot',
  'leaf',
  'chef-hat',
  'flame',
  'package',
  'can',
  'star',
  'sparkles',
  'shopping-cart',
  'tag',
];

const store = createFirestoreStore<RecipeCategory>(
  'app-alimentacao:user-recipe-categories',
  'recipeCategories',
);

const SEED_FLAG = 'app-alimentacao:recipe-categories-seeded';
let seedChecked = false;

/**
 * Semeia as categorias padrão uma única vez, apenas depois que o estado real do
 * Firestore chegou (para não recriar categorias que o usuário já apagou).
 */
function ensureSeeded(): void {
  if (seedChecked) return;
  try {
    if (localStorage.getItem(SEED_FLAG)) {
      seedChecked = true;
      return;
    }
  } catch {
    // ignore
  }
  if (!store.isHydrated()) return;
  if (store.getAll().length === 0) {
    DEFAULT_RECIPE_CATEGORIES.forEach((c) => store.upsert(c));
  }
  try {
    localStorage.setItem(SEED_FLAG, '1');
  } catch {
    // ignore
  }
  seedChecked = true;
}

function sortCategories(list: RecipeCategory[]): RecipeCategory[] {
  return [...list].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'pt-BR'),
  );
}

export function getRecipeCategories(): RecipeCategory[] {
  return sortCategories(store.getAll());
}

export function useRecipeCategories(): RecipeCategory[] {
  const cats = store.useAll();
  useEffect(() => {
    ensureSeeded();
  }, [cats]);
  return sortCategories(cats);
}

export function findRecipeCategory(id: string): RecipeCategory | undefined {
  return store.getAll().find((c) => c.id === id);
}

export function upsertRecipeCategory(cat: RecipeCategory): void {
  store.upsert(cat);
}

export function deleteRecipeCategory(id: string): void {
  store.remove(id);
}

/** Regrava a ordem (campo `order`) conforme a posição na lista recebida. */
export function reorderRecipeCategories(list: RecipeCategory[]): void {
  list.forEach((c, i) => {
    if (c.order !== i) store.upsert({ ...c, order: i });
  });
}
