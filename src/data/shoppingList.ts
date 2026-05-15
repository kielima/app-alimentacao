import { createLocalStore } from '../utils/localStore';
import type { ShoppingItem } from '../types/shoppingList';

const store = createLocalStore<ShoppingItem>('app-alimentacao:shopping-list');

export const getShoppingList = store.getAll;
export const getShoppingItem = store.getById;
export const upsertShoppingItem = store.upsert;
export const deleteShoppingItem = store.remove;
export const replaceShoppingList = store.replace;
export const useShoppingItems = store.useAll;
