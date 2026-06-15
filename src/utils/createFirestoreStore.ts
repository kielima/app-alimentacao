import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db, firebaseConfigured } from '../lib/firebase';
import { getCurrentUid, onUidChange } from '../lib/session';
import { flushPendingWrites, markServerSync } from '../lib/syncStatus';

/**
 * Cache local síncrono + Firestore sob users/{uid}/{collectionName}.
 * - Reads são imediatos (cache em memória, espelhado em localStorage).
 * - Subscrição é criada apenas quando há um uid válido (usuário aprovado),
 *   e recriada se o uid mudar (login/logout/troca de conta).
 * - Writes locais são fire-and-forget pro Firestore.
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
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch {
      // ignore quota errors
    }
    listeners.forEach((l) => l());
  }

  function clearCache() {
    cache = [];
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    listeners.forEach((l) => l());
  }

  // --- Firestore helpers (fire-and-forget) ---

  function userCol(uid: string) {
    if (!db) throw new Error('Firestore não configurado');
    return collection(db, 'users', uid, collectionName);
  }

  function fsUpsert(item: T) {
    if (!firebaseConfigured || !db) return;
    const uid = getCurrentUid();
    if (!uid) {
      console.error(
        `[store:${collectionName}] escrita ignorada (upsert): sem usuário logado. ` +
          `A alteração ficou apenas no cache local e será perdida no próximo arranque.`,
      );
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...rest } = item as T & { id: string };
    try {
      setDoc(doc(userCol(uid), item.id), rest).catch((err) =>
        console.warn(`[store:${collectionName}] upsert failed:`, err),
      );
      flushPendingWrites();
    } catch (err) {
      // setDoc valida os dados de forma síncrona e pode lançar (ex.: valor
      // inválido). Não deixar isso abortar o salvamento otimista local.
      console.error(`[store:${collectionName}] upsert inválido:`, err);
    }
  }

  function fsDelete(id: string) {
    if (!firebaseConfigured || !db) return;
    const uid = getCurrentUid();
    if (!uid) {
      console.error(
        `[store:${collectionName}] remoção ignorada: sem usuário logado.`,
      );
      return;
    }
    deleteDoc(doc(userCol(uid), id)).catch((err) =>
      console.warn(`[store:${collectionName}] delete failed:`, err),
    );
    flushPendingWrites();
  }

  function fsBatchWrite(toDelete: string[], toUpsert: T[]) {
    if (!firebaseConfigured || !db) return;
    const uid = getCurrentUid();
    if (!uid) {
      console.error(
        `[store:${collectionName}] gravação em lote ignorada: sem usuário logado.`,
      );
      return;
    }
    const fsDb = db;
    try {
      const batch = writeBatch(fsDb);
      toDelete.forEach((id) => batch.delete(doc(userCol(uid), id)));
      toUpsert.forEach((item) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...rest } = item as T & { id: string };
        batch.set(doc(userCol(uid), item.id), rest);
      });
      batch
        .commit()
        .catch((err) => console.warn(`[store:${collectionName}] batch failed:`, err));
      flushPendingWrites();
    } catch (err) {
      console.error(`[store:${collectionName}] batch inválido:`, err);
    }
  }

  // --- Subscrição reativa ao uid atual ---

  let unsub: Unsubscribe | null = null;
  // `hydrated` = já recebemos pelo menos um snapshot do Firestore para o uid
  // atual, ou seja, o cache reflete o estado real do servidor. Enquanto for
  // false, operações destrutivas (apagar em massa via replace) são proibidas,
  // para não apagar dados do servidor que ainda não chegaram ao cache.
  let hydrated = false;

  function subscribeFor(uid: string) {
    if (!firebaseConfigured || !db) return;
    try {
      unsub = onSnapshot(
        userCol(uid),
        // includeMetadataChanges: necessário para receber o snapshot confirmado
        // pelo servidor (fromCache=false) mesmo quando os dados não mudaram —
        // é isso que regista a hora da última sincronização ao abrir o app.
        { includeMetadataChanges: true },
        (snapshot) => {
          hydrated = true;
          // Snapshot vindo do servidor (não do cache) confirma sincronização.
          if (!snapshot.metadata.fromCache) markServerSync();
          const docs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as T));
          setCache(docs);
        },
        (err) => console.warn(`[store:${collectionName}] snapshot error:`, err),
      );
    } catch (err) {
      console.warn(`[store:${collectionName}] subscribe failed:`, err);
    }
  }

  function tearDown() {
    hydrated = false;
    if (unsub) {
      unsub();
      unsub = null;
    }
  }

  // Quando não há Firestore configurado, o store é puramente local (localStorage)
  // e o cache já é a fonte de verdade desde o início.
  function isHydrated(): boolean {
    return !firebaseConfigured || !db ? true : hydrated;
  }

  // Reage a mudanças de uid: tear down + clear cache + resubscribe.
  onUidChange((uid) => {
    tearDown();
    clearCache();
    if (uid) subscribeFor(uid);
  });

  // Caso o uid já esteja setado quando o módulo carrega (improvável, mas seguro).
  const initialUid = getCurrentUid();
  if (initialUid) subscribeFor(initialUid);

  // --- API pública (síncrona) ---

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
    // Proteção contra perda de dados: se ainda não carregamos o estado real do
    // Firestore (cache pode estar vazio logo após abrir o app), nunca calculamos
    // remoções a partir desse cache — isso apagaria dados do servidor que ainda
    // não chegaram. Em vez disso, apenas gravamos (upsert) os itens recebidos.
    if (!isHydrated()) {
      console.error(
        `[store:${collectionName}] replace() sem apagar: dados ainda não ` +
          `carregados do Firestore. Itens recebidos foram gravados, mas nada ` +
          `foi removido para evitar perda de dados.`,
      );
      const merged = [...cache];
      list.forEach((item) => {
        const idx = merged.findIndex((r) => r.id === item.id);
        if (idx >= 0) merged[idx] = item;
        else merged.push(item);
      });
      setCache(merged);
      fsBatchWrite([], list);
      return;
    }
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

  return { getAll, getById, upsert, remove, replace, useAll, isHydrated };
}
