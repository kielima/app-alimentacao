import { serverTimestamp } from 'firebase/firestore';
import { createFirestoreDocStore } from '../utils/createFirestoreDocStore';
import type { UserProfile } from '../types/userProfile';

const store = createFirestoreDocStore<UserProfile>({
  storageKey: 'app-alimentacao:user-profile',
  collection: 'household',
  docId: 'main',
  pick: (raw) => {
    if (!raw) return null;
    const profile = (raw as { profile?: UserProfile }).profile;
    return profile ?? null;
  },
  merge: (profile) => ({
    profile: { ...profile, updatedAt: new Date().toISOString() },
    updatedAt: serverTimestamp(),
  }),
});

export function getUserProfile(): UserProfile | null {
  return store.get();
}

export function setUserProfile(profile: UserProfile): void {
  store.set(profile);
}

export function patchUserProfile(partial: Partial<UserProfile>): void {
  store.patch(partial);
}

export function useUserProfile(): UserProfile | null {
  return store.useValue();
}
