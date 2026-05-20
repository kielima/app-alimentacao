import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { ADMIN_EMAIL, auth, db, firebaseConfigured, googleProvider } from './firebase';

export type AccessStatus = 'pending' | 'approved' | 'rejected';

export interface UserRecord {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  status: AccessStatus;
  requestedAt?: unknown;
  approvedAt?: unknown;
  approvedBy?: string | null;
}

function requireFirebase(): { authInstance: NonNullable<typeof auth>; dbInstance: NonNullable<typeof db> } {
  if (!firebaseConfigured || !auth || !db) {
    throw new Error('Firebase não configurado.');
  }
  return { authInstance: auth, dbInstance: db };
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export function onAuthStateReady(cb: (user: User | null) => void): Unsubscribe {
  const { authInstance } = requireFirebase();
  return onAuthStateChanged(authInstance, cb);
}

export async function signInWithGoogle(): Promise<User> {
  const { authInstance } = requireFirebase();
  if (!googleProvider) {
    throw new Error('Provider Google não configurado.');
  }
  const cred = await signInWithPopup(authInstance, googleProvider);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  const { authInstance } = requireFirebase();
  await fbSignOut(authInstance);
}

/**
 * Garante que existe um doc users/{uid}. Se não existir, cria como pending.
 * O admin (email hardcoded) é automaticamente aprovado na criação.
 */
export async function ensureUserRecord(user: User): Promise<UserRecord> {
  const { dbInstance } = requireFirebase();
  const ref = doc(dbInstance, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as UserRecord;
  }
  const initialStatus: AccessStatus = isAdminEmail(user.email) ? 'approved' : 'pending';
  const record: Omit<UserRecord, 'requestedAt' | 'approvedAt'> & {
    requestedAt: unknown;
    approvedAt: unknown | null;
  } = {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName,
    photoURL: user.photoURL,
    status: initialStatus,
    requestedAt: serverTimestamp(),
    approvedAt: initialStatus === 'approved' ? serverTimestamp() : null,
    approvedBy: initialStatus === 'approved' ? user.uid : null,
  };
  await setDoc(ref, record);
  return record as UserRecord;
}

/**
 * Observa o doc users/{uid} para reagir a mudanças de status em tempo real.
 */
export function subscribeUserRecord(
  uid: string,
  cb: (event:
    | { type: 'data'; record: UserRecord | null }
    | { type: 'error'; error: Error }) => void,
): Unsubscribe {
  const { dbInstance } = requireFirebase();
  return onSnapshot(
    doc(dbInstance, 'users', uid),
    (snap) => {
      cb({ type: 'data', record: snap.exists() ? (snap.data() as UserRecord) : null });
    },
    (err) => {
      console.warn('[auth] subscribeUserRecord error:', err);
      cb({ type: 'error', error: err });
    },
  );
}

/**
 * Lista todos os pendentes (somente admin tem permissão pelas rules).
 */
export function subscribePendingUsers(cb: (users: UserRecord[]) => void): Unsubscribe {
  const { dbInstance } = requireFirebase();
  const q = query(collection(dbInstance, 'users'), where('status', '==', 'pending'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as UserRecord);
      cb(list);
    },
    (err) => {
      console.warn('[auth] subscribePendingUsers error:', err);
      cb([]);
    },
  );
}

export async function approveUser(uid: string, adminUid: string): Promise<void> {
  const { dbInstance } = requireFirebase();
  await updateDoc(doc(dbInstance, 'users', uid), {
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedBy: adminUid,
  });
}

export async function rejectUser(uid: string, adminUid: string): Promise<void> {
  const { dbInstance } = requireFirebase();
  await updateDoc(doc(dbInstance, 'users', uid), {
    status: 'rejected',
    approvedAt: serverTimestamp(),
    approvedBy: adminUid,
  });
}

export { GoogleAuthProvider };
