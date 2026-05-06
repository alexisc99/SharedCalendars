import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { clearToken, getToken, saveToken } from "./authToken";
import type { LoginResponse, MeResponse } from "./types";

type SessionState = {
  isBootstrapping: boolean;
  me: MeResponse | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);

  async function refreshMe() {
    const data = await api.get<MeResponse>("/users/me");
    setMe(data);
  }

  async function bootstrap() {
    try {
      const token = await getToken();
      if (!token) {
        setMe(null);
        return;
      }
      await refreshMe();
    } catch {
      setMe(null);
      await clearToken();
    } finally {
      setIsBootstrapping(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<LoginResponse>("/auth/login", { email, password });
    await saveToken(res.data.access_token);
    await refreshMe();
  }

  async function logout() {
    await clearToken();
    setMe(null);
  }

  const value = useMemo(
    () => ({ isBootstrapping, me, login, logout, refreshMe }),
    [isBootstrapping, me]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
