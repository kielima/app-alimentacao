// Estado global de sincronização com o Firestore.
//
// - `flushPendingWrites()` é chamado após cada escrita local. Usa
//   `waitForPendingWrites` para FORÇAR/confirmar que as escritas chegaram ao
//   servidor; só então regista o timestamp da última sincronização.
// - `markServerSync()` é chamado quando uma leitura (snapshot) vem do servidor
//   (não do cache), o que também confirma contato com o Firestore.
// - O último timestamp é espelhado em localStorage para sobreviver a recargas.

import { waitForPendingWrites } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db, firebaseConfigured } from './firebase';

const STORAGE_KEY = 'app-alimentacao:last-sync-at';

export interface SyncState {
  /** Epoch ms da última sincronização confirmada com o Firestore, ou null. */
  lastSyncedAt: number | null;
  /** Há escritas locais ainda não confirmadas pelo servidor. */
  pending: boolean;
}

function readStored(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

let state: SyncState = { lastSyncedAt: readStored(), pending: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  emit();
}

function recordSynced() {
  const at = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // ignore quota / private mode
  }
  setState({ lastSyncedAt: at, pending: false });
}

/** Sincronização confirmada por leitura vinda do servidor (snapshot não-cache). */
export function markServerSync(): void {
  recordSynced();
}

/**
 * Chamado após cada escrita local. Marca como pendente e só confirma a
 * sincronização quando o Firestore garante que não há escritas pendentes
 * (ou seja, chegaram ao servidor). Offline: resolve quando a rede voltar.
 */
export function flushPendingWrites(): void {
  if (!firebaseConfigured || !db) return;
  setState({ pending: true });
  waitForPendingWrites(db)
    .then(() => recordSynced())
    .catch(() => setState({ pending: false }));
}

export function getSyncState(): SyncState {
  return state;
}

/** Hook React reativo ao estado de sincronização. */
export function useSyncStatus(): SyncState {
  const [snap, setSnap] = useState<SyncState>(state);
  useEffect(() => {
    const l = () => setSnap(state);
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return snap;
}
