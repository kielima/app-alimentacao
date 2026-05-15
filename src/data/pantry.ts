import { createLocalStore } from '../utils/localStore';
import type { PantryItem } from '../types/pantry';

const store = createLocalStore<PantryItem>('app-alimentacao:pantry');

export const getPantry = store.getAll;
export const getPantryItem = store.getById;
export const upsertPantryItem = store.upsert;
export const deletePantryItem = store.remove;
export const usePantryItems = store.useAll;
