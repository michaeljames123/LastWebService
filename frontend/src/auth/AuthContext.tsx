import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { User } from "../types";
import { getMe, loginUser, registerUser, type RegisterInput } from "../api/api";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "agridronescan_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      setToken(existing);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) {
        setUser(null);
        return;
      }

      try {
        const me = await getMe(token);
        if (!cancelled) {
          setUser(me);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setToken(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      async login(identifier: string, password: string) {
        setLoading(true);
        try {
          const tok = await loginUser(identifier, password);
          localStorage.setItem(STORAGE_KEY, tok.access_token);
          setToken(tok.access_token);
          const me = await getMe(tok.access_token);
          setUser(me);
        } finally {
          setLoading(false);
        }
      },
      async register(input: RegisterInput) {
        setLoading(true);
        try {
          await registerUser(input);
          const tok = await loginUser(input.email, input.password);
          localStorage.setItem(STORAGE_KEY, tok.access_token);
          setToken(tok.access_token);
          const me = await getMe(tok.access_token);
          setUser(me);
        } finally {
          setLoading(false);
        }
      },
      logout() {
        setUser(null);
        setToken(null);
        localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
