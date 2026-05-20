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
  | { phase: 'approved'; user: User; record: UserRecord; isAdmin: boolean }
  | { phase: 'error'; user: User; message: string };

export interface UseAuth {
  state: AuthState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signInError: string | null;
  signingIn: boolean;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
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
        if (!cancelled) {
          setCurrentUid(null);
          setState({
            phase: 'error',
            user,
            message: errorMessage(
              err,
              'Falha ao criar seu registro de usuário. Verifique as Firestore rules.',
            ),
          });
        }
        return;
      }
      if (cancelled) return;
      recordUnsub = subscribeUserRecord(user.uid, (event) => {
        if (event.type === 'error') {
          setCurrentUid(null);
          setState({
            phase: 'error',
            user,
            message: errorMessage(
              event.error,
              'Falha ao ler seu registro de usuário. Verifique as Firestore rules.',
            ),
          });
          return;
        }
        const record = event.record;
        if (!record) {
          // doc ainda não existe (eventual consistency). Mantém estado anterior.
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
      setSignInError(errorMessage(err, 'Erro ao entrar.'));
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
