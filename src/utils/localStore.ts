import { useEffect, useState } from 'react';

/**
 * Cria um "store" reativo simples em localStorage. Retorna helpers
 * para CRUD + um hook React que re-renderiza quando o store muda.
 */
export function createLocalStore<T extends { id: string }>(storageKey: string) {
  type Listener = () => void;
  const listeners = new Set<Listener>();

  function read(): T[] {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function write(list: T[]) {
    localStorage.setItem(storageKey, JSON.stringify(list));
    listeners.forEach((l) => l());
  }

  function getAll(): T[] {
    return read();
  }

  function getById(id: string): T | undefined {
    return read().find((r) => r.id === id);
  }

  function upsert(item: T): void {
    const list = read();
    const idx = list.findIndex((r) => r.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    write(list);
  }

  function remove(id: string): void {
    write(read().filter((r) => r.id !== id));
  }

  function replace(list: T[]): void {
    write(list);
  }

  function useAll(): T[] {
    const [items, setItems] = useState<T[]>(read);
    useEffect(() => {
      const listener = () => setItems(read());
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }, []);
    return items;
  }

  return { getAll, getById, upsert, remove, replace, useAll };
}
