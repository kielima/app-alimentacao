import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ensureUserRecord,
  isAdminEmail,
  onAuthStateReady,
  signInWithGoogle,
  signOutUser,
  subscribeUserRecord,
  type AccessStatus,
  type UserRecord,
} from '../lib/auth';
import { firebaseConfigured } from '../lib/firebase';
import { setCurrentUid } from '../lib/session';

export type AuthState =
  | { phase: 'loading' }
  | { phase: 'unconfigured' }
  | { phase: 'signed-out' }
  | { phase: 'pending'; user: User; record: UserRecord }
  | { phase: 'rejected'; user: User; record: UserRecord }
  | { phase: 'approved'; user: User; record: UserRecord; isAdmin: boolean };

export interface UseAuth {
  state: AuthState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signInError: string | null;
  signingIn: boolean;
}

export function useAuth(): UseAuth {
  const [state, setState] = useState<AuthState>(() =>
    firebaseConfigured ? { phase: 'loading' } : { phase: 'unconfigured' },
  );
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) {
      setCurrentUid(null);
      return;
    }

    let recordUnsub: (() => void) | null = null;
    let cancelled = false;

    const unsubAuth = onAuthStateReady(async (user) => {
      if (recordUnsub) {
        recordUnsub();
        recordUnsub = null;
      }
      if (!user) {
        setCurrentUid(null);
        if (!cancelled) setState({ phase: 'signed-out' });
        return;
      }
      try {
        await ensureUserRecord(user);
      } catch (err) {
        console.error('[useAuth] Falha ao garantir users/{uid}:', err);
      }
      if (cancelled) return;
      recordUnsub = subscribeUserRecord(user.uid, (record) => {
        if (!record) {
          setCurrentUid(null);
          setState({ phase: 'signed-out' });
          return;
        }
        const status: AccessStatus = record.status;
        if (status === 'approved') {
          setCurrentUid(user.uid);
          setState({
            phase: 'approved',
            user,
            record,
            isAdmin: isAdminEmail(user.email),
          });
        } else if (status === 'rejected') {
          setCurrentUid(null);
          setState({ phase: 'rejected', user, record });
        } else {
          setCurrentUid(null);
          setState({ phase: 'pending', user, record });
        }
      });
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (recordUnsub) recordUnsub();
      setCurrentUid(null);
    };
  }, []);

  const signIn = useCallback(async () => {
    setSignInError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao entrar.';
      setSignInError(msg);
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.warn('[useAuth] signOut error:', err);
    }
  }, []);

  return { state, signIn, signOut, signInError, signingIn };
}
