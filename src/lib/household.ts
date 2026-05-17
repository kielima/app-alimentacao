import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db, firebaseConfigured } from './firebase';
import type { UserProfile } from '../types/userProfile';

const HOUSEHOLD_ID = 'main';

export interface HouseholdDoc {
  pinHash: string;
  profile?: UserProfile;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function ensureAnonAuth(): Promise<User> {
  if (!firebaseConfigured || !auth) {
    return Promise.reject(new Error('Firebase não configurado'));
  }
  const authInstance = auth;
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      authInstance,
      (user) => {
        unsubscribe();
        if (user) {
          resolve(user);
        } else {
          signInAnonymously(authInstance).then((cred) => resolve(cred.user)).catch(reject);
        }
      },
      reject,
    );
  });
}

export async function readHousehold(): Promise<HouseholdDoc | null> {
  if (!firebaseConfigured || !db) return null;
  await ensureAnonAuth();
  const snap = await getDoc(doc(db, 'household', HOUSEHOLD_ID));
  return snap.exists() ? (snap.data() as HouseholdDoc) : null;
}

export async function writeHouseholdPin(pinHash: string): Promise<void> {
  if (!firebaseConfigured || !db) {
    throw new Error('Firebase não configurado');
  }
  await ensureAnonAuth();
  const existing = await readHousehold();
  await setDoc(
    doc(db, 'household', HOUSEHOLD_ID),
    {
      pinHash,
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
