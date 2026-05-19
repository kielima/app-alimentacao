import { useMemo } from 'react';
import { createFirestoreStore } from '../utils/createFirestoreStore';

interface HiddenIngredient {
  id: string;
  hidden_at: string;
}

const store = createFirestoreStore<HiddenIngredient>(
  'app-alimentacao:hidden-ingredients',
  'hiddenIngredients',
);

export function hideIngredient(id: string): void {
  store.upsert({ id, hidden_at: new Date().toISOString() });
}

export function unhideIngredient(id: string): void {
  store.remove(id);
}

export function isIngredientHidden(id: string): boolean {
  return !!store.getById(id);
}

export function getHiddenIngredients() {
  return store.getAll();
}

export function upsertHiddenIngredient(item: { id: string; hidden_at: string }) {
  store.upsert(item);
}

export function replaceHiddenIngredients(items: { id: string; hidden_at: string }[]) {
  store.replace(items);
}

export function getHiddenIngredientIds(): Set<string> {
  return new Set(store.getAll().map((r) => r.id));
}

export function useHiddenIngredientIds(): Set<string> {
  const list = store.useAll();
  return useMemo(() => new Set(list.map((r) => r.id)), [list]);
}
