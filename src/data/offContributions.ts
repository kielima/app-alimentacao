import { createFirestoreStore } from '../utils/createFirestoreStore';
import type { OffContributionDraft } from '../types/offContribution';

const store = createFirestoreStore<OffContributionDraft>(
  'app-alimentacao:off-contributions',
  'offContributions',
);

export const getOffContributions = store.getAll;
export const getOffContribution = store.getById;
export const upsertOffContribution = store.upsert;
export const deleteOffContribution = store.remove;
export const useOffContributions = store.useAll;
