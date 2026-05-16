import { useEffect, useReducer } from 'react';

/**
 * Estado UI em escopo de módulo. Sobrevive à desmontagem de componentes
 * (ex.: ir ao detalhe e voltar) mas é resetado em reload da página.
 */
export function createUIStore<T extends Record<string, unknown>>(initial: T) {
  let state: T = { ...initial };
  const listeners = new Set<() => void>();

  function set<K extends keyof T>(key: K, value: T[K] | ((prev: T[K]) => T[K])) {
    const next =
      typeof value === 'function'
        ? (value as (prev: T[K]) => T[K])(state[key])
        : value;
    if (Object.is(state[key], next)) return;
    state = { ...state, [key]: next };
    listeners.forEach((l) => l());
  }

  function useStore(): T {
    const [, force] = useReducer((x: number) => x + 1, 0);
    useEffect(() => {
      listeners.add(force);
      return () => {
        listeners.delete(force);
      };
    }, []);
    return state;
  }

  return { useStore, set, get: () => state };
}
