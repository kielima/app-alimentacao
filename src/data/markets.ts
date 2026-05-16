import { createFirestoreStore } from '../utils/createFirestoreStore';
import type { Market } from '../types/market';

const store = createFirestoreStore<Market>('app-alimentacao:markets', 'markets');

export const getMarkets = store.getAll;
export const getMarket = store.getById;
export const upsertMarket = store.upsert;
export const deleteMarket = store.remove;
export const useMarkets = store.useAll;
