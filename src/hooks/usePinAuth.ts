import { useCallback, useEffect, useState } from 'react';
import { firebaseConfigured } from '../lib/firebase';
import { readHousehold, writeHouseholdPin } from '../lib/household';

const PIN_HASH_KEY = 'app-alimentacao:pin-hash';

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface State {
  loading: boolean;
  hasPin: boolean;
  authenticated: boolean;
  pinHash: string | null;
}

export function usePinAuth() {
  const [state, setState] = useState<State>(() => {
    if (firebaseConfigured) {
      return { loading: true, hasPin: false, authenticated: false, pinHash: null };
    }
    const stored = localStorage.getItem(PIN_HASH_KEY);
    return {
      loading: false,
      hasPin: !!stored,
      authenticated: false,
      pinHash: stored,
    };
  });

  useEffect(() => {
    if (!firebaseConfigured) return;
    let cancelled = false;
    readHousehold()
      .then((household) => {
        if (cancelled) return;
        setState({
          loading: false,
          hasPin: !!household?.pinHash,
          authenticated: false,
          pinHash: household?.pinHash ?? null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[usePinAuth] Falha ao ler household no Firestore:', err);
        const stored = localStorage.getItem(PIN_HASH_KEY);
        setState({
          loading: false,
          hasPin: !!stored,
          authenticated: false,
          pinHash: stored,
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPin = useCallback(async (pin: string) => {
    const hash = await hashPin(pin);
    if (firebaseConfigured) {
      try {
        await writeHouseholdPin(hash);
      } catch (err) {
        console.error('[usePinAuth] Falha ao salvar PIN no Firestore:', err);
        return false;
      }
    }
    localStorage.setItem(PIN_HASH_KEY, hash);
    setState({ loading: false, hasPin: true, authenticated: true, pinHash: hash });
    return true;
  }, []);

  const verifyPin = useCallback(
    async (pin: string) => {
      const hash = await hashPin(pin);
      const expected = state.pinHash ?? localStorage.getItem(PIN_HASH_KEY);
      if (!expected) return false;
      if (hash === expected) {
        localStorage.setItem(PIN_HASH_KEY, expected);
        setState((s) => ({ ...s, authenticated: true }));
        return true;
      }
      return false;
    },
    [state.pinHash],
  );

  const signOut = useCallback(() => {
    setState((s) => ({ ...s, authenticated: false }));
  }, []);

  return {
    loading: state.loading,
    hasPin: state.hasPin,
    authenticated: state.authenticated,
    setPin,
    verifyPin,
    signOut,
  };
}
