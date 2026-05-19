import { useMemo } from 'react';
import { createFirestoreStore } from '../utils/createFirestoreStore';

interface HiddenRecipe {
  id: string;
  hidden_at: string;
}

const store = createFirestoreStore<HiddenRecipe>(
  'app-alimentacao:hidden-recipes',
  'hiddenRecipes',
);

export function hideRecipe(id: string): void {
  store.upsert({ id, hidden_at: new Date().toISOString() });
}

export function unhideRecipe(id: string): void {
  store.remove(id);
}

export function isRecipeHidden(id: string): boolean {
  return !!store.getById(id);
}

export function getHiddenRecipes() {
  return store.getAll();
}

export function getHiddenRecipeIds(): Set<string> {
  return new Set(store.getAll().map((r) => r.id));
}

export function useHiddenRecipeIds(): Set<string> {
  const list = store.useAll();
  return useMemo(() => new Set(list.map((r) => r.id)), [list]);
}
