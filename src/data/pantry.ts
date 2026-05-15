import { createFirestoreStore } from '../utils/createFirestoreStore';
import type { PantryItem } from '../types/pantry';

const store = createFirestoreStore<PantryItem>('app-alimentacao:pantry', 'pantry');

export const getPantry = store.getAll;
export const getPantryItem = store.getById;
export const upsertPantryItem = store.upsert;
export const deletePantryItem = store.remove;
export const usePantryItems = store.useAll;
