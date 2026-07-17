import { createFirestoreStore } from '../utils/createFirestoreStore';
import type { HouseholdItem } from '../types/household';

const store = createFirestoreStore<HouseholdItem>(
  'app-alimentacao:household-items',
  'householdItems',
);

export const getHouseholdItems = store.getAll;
export const getHouseholdItem = store.getById;
export const upsertHouseholdItem = store.upsert;
export const deleteHouseholdItem = store.remove;
export const replaceHouseholdItems = store.replace;
export const useHouseholdItems = store.useAll;
export const isHouseholdItemsHydrated = store.isHydrated;
