import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { io, type Socket } from 'socket.io-client';
import type { AuthSession } from '@converse/shared';
import { API_URL, setMobileAuthToken } from '../config/api';

const SESSION_KEY = 'converse_mobile_session';
const FALLBACK_SESSION_FILE = `${FileSystem.documentDirectory || ''}converse_session.json`;

async function readSavedSession(): Promise<string | null> {
  try {
    const val = await SecureStore.getItemAsync(SESSION_KEY);
    if (val) return val;
  } catch {
    // Simulator sem entitlement de Keychain faz fallback para FileSystem
  }
  try {
    if (FileSystem.documentDirectory) {
      const info = await FileSystem.getInfoAsync(FALLBACK_SESSION_FILE);
      if (info.exists) {
        return await FileSystem.readAsStringAsync(FALLBACK_SESSION_FILE);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function writeSavedSession(raw: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, raw);
    return;
  } catch {
    // Fallback para builds de simulador sem assinatura/entitlement
  }
  try {
    if (FileSystem.documentDirectory) {
      await FileSystem.writeAsStringAsync(FALLBACK_SESSION_FILE, raw);
    }
  } catch {
    // ignore
  }
}

async function clearSavedSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // ignore
  }
  try {
    if (FileSystem.documentDirectory) {
      await FileSystem.deleteAsync(FALLBACK_SESSION_FILE, { idempotent: true });
    }
  } catch {
    // ignore
  }
}

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  socket: Socket | null;
  signIn: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      if (active) setLoading(false);
    }, 1500);

    readSavedSession()
      .then((raw) => {
        if (raw && active) {
          const parsed = JSON.parse(raw) as AuthSession;
          setMobileAuthToken(parsed.token);
          setSession(parsed);
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(API_URL, {
      auth: { token: session.token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [session?.token]);

  const signIn = async (newSession: AuthSession) => {
    setMobileAuthToken(newSession.token);
    setSession(newSession);
    await writeSavedSession(JSON.stringify(newSession));
  };

  const signOut = async () => {
    setMobileAuthToken(null);
    setSession(null);
    await clearSavedSession();
  };

  return (
    <AuthContext.Provider value={{ session, loading, socket: socketRef.current, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
