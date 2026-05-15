import { useCallback, useEffect, useState } from 'react';

const PIN_HASH_KEY = 'app-alimentacao:pin-hash';
const SESSION_KEY = 'app-alimentacao:session-until';
const SESSION_DAYS = 30;

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function sessionValid(): boolean {
  const until = Number(localStorage.getItem(SESSION_KEY));
  return Number.isFinite(until) && until > Date.now();
}

function extendSession() {
  const until = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(SESSION_KEY, String(until));
}

export function usePinAuth() {
  const [hasPin, setHasPin] = useState(() => !!localStorage.getItem(PIN_HASH_KEY));
  const [authenticated, setAuthenticated] = useState(() => sessionValid() && !!localStorage.getItem(PIN_HASH_KEY));

  useEffect(() => {
    setHasPin(!!localStorage.getItem(PIN_HASH_KEY));
  }, []);

  const setPin = useCallback(async (pin: string) => {
    const hash = await hashPin(pin);
    localStorage.setItem(PIN_HASH_KEY, hash);
    setHasPin(true);
    extendSession();
    setAuthenticated(true);
    return true;
  }, []);

  const verifyPin = useCallback(async (pin: string) => {
    const stored = localStorage.getItem(PIN_HASH_KEY);
    if (!stored) return false;
    const hash = await hashPin(pin);
    if (hash === stored) {
      extendSession();
      setAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setAuthenticated(false);
  }, []);

  return { hasPin, authenticated, setPin, verifyPin, signOut };
}
