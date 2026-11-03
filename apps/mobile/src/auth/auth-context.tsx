import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  configureApiClient,
  getClientSession,
  setClientSession,
} from '../lib/api/client';
import { getMe, loginUser, logoutUser, registerUser } from '../lib/api/auth-api';
import { clearSession, loadSession, saveSession } from './session-storage';
import type { AuthResponse, AuthStatus, PublicUser, Session } from './types';

interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { name: string; email: string; phone?: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);

  const applySession = useCallback((session: Session | null) => {
    setClientSession(session);
    if (session) {
      void saveSession(session);
      setUser(session.user);
      setStatus('authenticated');
    } else {
      void clearSession();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    configureApiClient({
      onSessionChange: applySession,
      onAuthFailure: () => {
        setClientSession(null);
        void clearSession();
        setUser(null);
        setStatus('unauthenticated');
      },
    });

    let cancelled = false;
    (async () => {
      const stored = await loadSession();
      if (cancelled) return;
      if (!stored) {
        setStatus('unauthenticated');
        return;
      }
      setClientSession(stored);
      try {
        // Validates stored credentials and rotates the refresh token.
        await getMe();
        if (!cancelled) {
          setUser(stored.user);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) applySession(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const response: AuthResponse = await loginUser({ email, password });
      applySession(response);
    },
    [applySession],
  );

  const signUp = useCallback(
    async (input: { name: string; email: string; phone?: string; password: string }) => {
      const response: AuthResponse = await registerUser(input);
      applySession(response);
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    const session = getClientSession();
    if (session) {
      await logoutUser(session.refreshToken).catch(() => {});
    }
    applySession(null);
  }, [applySession]);

  return (
    <AuthContext.Provider value={{ status, user, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
