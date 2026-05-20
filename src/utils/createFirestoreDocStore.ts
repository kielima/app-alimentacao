import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db, firebaseConfigured } from '../lib/firebase';
import { getCurrentUid, onUidChange } from '../lib/session';

/**
 * Cache local + Firestore para UM documento sob users/{uid}/{collection}/{docId}.
 * Reage a mudanças de uid igual ao createFirestoreStore.
 */
export function createFirestoreDocStore<T>(opts: {
  storageKey: string;
  collection: string;
  docId: string;
  pick: (raw: Record<string, unknown> | null) => T | null;
  merge: (patch: T) => Record<string, unknown>;
}) {
  const { storageKey, collection: collectionName, docId, pick, merge } = opts;

  type Listener = () => void;
  const listeners = new Set<Listener>();

  function readCache(): T | null {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  let cache: T | null = readCache();

  function setCache(value: T | null) {
    cache = value;
    try {
      if (value === null) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(value));
      }
    } catch {
      // ignore
    }
    listeners.forEach((l) => l());
  }

  function fsWrite(value: T) {
    if (!firebaseConfigured || !db) return;
    const uid = getCurrentUid();
    if (!uid) return;
    setDoc(doc(db, 'users', uid, collectionName, docId), merge(value), { merge: true }).catch(
      (err) => console.warn(`[docstore:${collectionName}/${docId}] write failed:`, err),
    );
  }

  let unsub: Unsubscribe | null = null;

  function subscribeFor(uid: string) {
    if (!firebaseConfigured || !db) return;
    try {
      const ref = doc(db, 'users', uid, collectionName, docId);
      unsub = onSnapshot(
        ref,
        (snap) => {
          const raw = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
          setCache(pick(raw));
        },
        (err) => console.warn(`[docstore:${collectionName}/${docId}] snapshot error:`, err),
      );
    } catch (err) {
      console.warn(`[docstore:${collectionName}/${docId}] subscribe failed:`, err);
    }
  }

  function tearDown() {
    if (unsub) {
      unsub();
      unsub = null;
    }
  }

  onUidChange((uid) => {
    tearDown();
    setCache(null);
    if (uid) subscribeFor(uid);
  });

  const initialUid = getCurrentUid();
  if (initialUid) subscribeFor(initialUid);

  function get(): T | null {
    return cache;
  }

  function set(value: T | null): void {
    setCache(value);
    if (value !== null) fsWrite(value);
  }

  function patch(partial: Partial<T>): void {
    const next = { ...(cache ?? ({} as T)), ...partial } as T;
    set(next);
  }

  function useValue(): T | null {
    const [value, setValue] = useState<T | null>(() => cache);
    useEffect(() => {
      const listener = () => setValue(cache);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }, []);
    return value;
  }

  return { get, set, patch, useValue };
}
