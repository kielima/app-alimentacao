import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db, firebaseConfigured } from '../lib/firebase';
import { ensureAnonAuth } from '../lib/household';

/**
 * Hybrid store para UM documento Firestore fixo.
 * - localStorage como cache síncrono.
 * - Escritas atualizam cache imediatamente, persistem no Firestore em background com merge.
 * - onSnapshot mantém o cache em dia.
 * - `pick` extrai o subset relevante do documento; `merge` constrói o patch a ser
 *   gravado, preservando outros campos do documento (ex.: pinHash).
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
    if (value === null) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(value));
    }
    listeners.forEach((l) => l());
  }

  function fsWrite(value: T) {
    if (!firebaseConfigured || !db) return;
    const fsDb = db;
    ensureAnonAuth()
      .then(() => setDoc(doc(fsDb, collectionName, docId), merge(value), { merge: true }))
      .catch((err) => console.warn(`[docstore:${collectionName}/${docId}] write failed:`, err));
  }

  let initialized = false;

  async function subscribe() {
    if (!firebaseConfigured || !db) return;
    try {
      await ensureAnonAuth();
      const ref = doc(db, collectionName, docId);
      onSnapshot(
        ref,
        (snap) => {
          const raw = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
          const remote = pick(raw);
          if (!initialized) {
            initialized = true;
            if (remote === null && cache !== null) {
              fsWrite(cache);
              return;
            }
          }
          setCache(remote);
        },
        (err) => console.warn(`[docstore:${collectionName}/${docId}] snapshot error:`, err),
      );
    } catch (err) {
      console.warn(`[docstore:${collectionName}/${docId}] subscribe failed:`, err);
    }
  }

  subscribe();

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
