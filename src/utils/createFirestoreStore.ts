import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, firebaseConfigured } from '../lib/firebase';
import { ensureAnonAuth } from '../lib/household';
import { useEffect, useState } from 'react';

/**
 * Hybrid store: localStorage como cache síncrono + Firestore como fonte de verdade.
 * - Leituras são imediatas (cache).
 * - Escritas atualizam o cache localmente e persistem no Firestore em background.
 * - onSnapshot sincroniza o cache quando o Firestore responde.
 * - Se Firebase não configurado, funciona apenas com localStorage.
 */
export function createFirestoreStore<T extends { id: string }>(
  storageKey: string,
  collectionName: string,
) {
  type Listener = () => void;
  const listeners = new Set<Listener>();

  function readCache(): T[] {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  let cache: T[] = readCache();

  function setCache(list: T[]) {
    cache = list;
    localStorage.setItem(storageKey, JSON.stringify(list));
    listeners.forEach((l) => l());
  }

  // --- Firestore helpers (fire-and-forget) ---

  function fsUpsert(item: T) {
    if (!firebaseConfigured || !db) return;
    const fsDb = db;
    ensureAnonAuth()
      .then(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...rest } = item as T & { id: string };
        return setDoc(doc(fsDb, collectionName, item.id), rest);
      })
      .catch((err) => console.warn(`[store:${collectionName}] upsert failed:`, err));
  }

  function fsDelete(id: string) {
    if (!firebaseConfigured || !db) return;
    const fsDb = db;
    ensureAnonAuth()
      .then(() => deleteDoc(doc(fsDb, collectionName, id)))
      .catch((err) => console.warn(`[store:${collectionName}] delete failed:`, err));
  }

  function fsBatchWrite(toDelete: string[], toUpsert: T[]) {
    if (!firebaseConfigured || !db) return;
    const fsDb = db;
    ensureAnonAuth()
      .then(() => {
        const batch = writeBatch(fsDb);
        toDelete.forEach((id) => batch.delete(doc(fsDb, collectionName, id)));
        toUpsert.forEach((item) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: _id, ...rest } = item as T & { id: string };
          batch.set(doc(fsDb, collectionName, item.id), rest);
        });
        return batch.commit();
      })
      .catch((err) => console.warn(`[store:${collectionName}] batch failed:`, err));
  }

  // --- Firestore subscription with auto-migration ---

  let initialized = false;

  async function subscribe() {
    if (!firebaseConfigured || !db) return;
    try {
      await ensureAnonAuth();
      const col = collection(db, collectionName);
      onSnapshot(
        col,
        (snapshot) => {
          const docs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as T));
          if (!initialized) {
            initialized = true;
            // Migrate localStorage data to Firestore if Firestore is empty
            if (docs.length === 0 && cache.length > 0) {
              fsBatchWrite([], cache);
              return; // keep using local cache until Firestore confirms
            }
          }
          setCache(docs);
        },
        (err) => console.warn(`[store:${collectionName}] snapshot error:`, err),
      );
    } catch (err) {
      console.warn(`[store:${collectionName}] subscribe failed:`, err);
    }
  }

  subscribe();

  // --- Public API (synchronous, matches createLocalStore interface) ---

  function getAll(): T[] {
    return cache;
  }

  function getById(id: string): T | undefined {
    return cache.find((r) => r.id === id);
  }

  function upsert(item: T): void {
    const list = [...cache];
    const idx = list.findIndex((r) => r.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    setCache(list);
    fsUpsert(item);
  }

  function remove(id: string): void {
    setCache(cache.filter((r) => r.id !== id));
    fsDelete(id);
  }

  function replace(list: T[]): void {
    const oldIds = new Set(cache.map((r) => r.id));
    const newIds = new Set(list.map((r) => r.id));
    const toDelete = [...oldIds].filter((id) => !newIds.has(id));
    setCache(list);
    fsBatchWrite(toDelete, list);
  }

  function useAll(): T[] {
    const [items, setItems] = useState<T[]>(() => cache);
    useEffect(() => {
      const listener = () => setItems([...cache]);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }, []);
    return items;
  }

  return { getAll, getById, upsert, remove, replace, useAll };
}
