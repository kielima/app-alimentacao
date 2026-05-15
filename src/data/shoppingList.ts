import { createFirestoreStore } from '../utils/createFirestoreStore';
import type { ShoppingItem } from '../types/shoppingList';

const store = createFirestoreStore<ShoppingItem>('app-alimentacao:shopping-list', 'shoppingList');

export const getShoppingList = store.getAll;
export const getShoppingItem = store.getById;
export const upsertShoppingItem = store.upsert;
export const deleteShoppingItem = store.remove;
export const replaceShoppingList = store.replace;
export const useShoppingItems = store.useAll;
