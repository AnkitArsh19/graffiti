import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiGetProfile, apiLogin, apiRegister } from "../lib/api";

interface AuthUser {
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  provider: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "graffiti:auth:token";
const USER_KEY = "graffiti:auth:user";

function parseJwt(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(USER_KEY);
      if (saved) return JSON.parse(saved);
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        const payload = parseJwt(savedToken);
        if (payload && (!payload.exp || payload.exp * 1000 > Date.now())) {
          return {
            userId: payload.sub || "",
            email: payload.email || "",
            name: payload.name || (payload.email ? payload.email.split("@")[0] : "User"),
            avatarUrl: payload.avatarUrl || null,
            provider: payload.provider || "LOCAL",
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await apiGetProfile();
      const updatedUser: AuthUser = {
        userId: profile.userId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        provider: profile.provider,
      };
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    } catch (err: any) {
      // Only clear auth on explicit 401 Unauthorized; keep session intact during offline or network drops
      const msg = err?.message || "";
      if (msg.includes("401") || err?.status === 401) {
        clearAuth();
      } else {
        console.warn("Could not refresh profile (offline or network drop), maintaining cached session:", err);
      }
    }
  }, [clearAuth]);

  // On mount, validate existing token
  useEffect(() => {
    if (token) {
      fetchProfile().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for auth expiry events from API client
  useEffect(() => {
    const handler = () => clearAuth();
    window.addEventListener("graffiti:auth:expired", handler);
    return () => window.removeEventListener("graffiti:auth:expired", handler);
  }, [clearAuth]);

  const loginWithToken = useCallback(
    async (newToken: string) => {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      const payload = parseJwt(newToken);
      if (payload) {
        const u: AuthUser = {
          userId: payload.sub || "",
          email: payload.email || "",
          name: payload.name || (payload.email ? payload.email.split("@")[0] : "User"),
          avatarUrl: payload.avatarUrl || null,
          provider: payload.provider || "LOCAL",
        };
        setUser(u);
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(u));
        } catch {}
      }
      await fetchProfile();
    },
    [fetchProfile]
  );

  // Listen for desktop auth login events & Tauri single-instance deep links
  useEffect(() => {
    const loginHandler = (e: any) => {
      if (e.detail?.token) {
        loginWithToken(e.detail.token);
      }
    };
    window.addEventListener("graffiti:auth:login", loginHandler);

    if (
      typeof window !== "undefined" &&
      Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__)
    ) {
      import("@tauri-apps/api/event")
        .then(({ listen }) => {
          return listen<string[] | string>("deep-link://new-url", async (event) => {
            const payload = event.payload;
            const urls = Array.isArray(payload) ? payload : [payload];
            for (const rawUrl of urls) {
              if (!rawUrl) continue;
              if (
                rawUrl.startsWith("graffiti://auth/callback") ||
                rawUrl.startsWith("graffiti://open-app") ||
                rawUrl.includes("code=")
              ) {
                try {
                  const { exchangeDesktopHandoffCode } = await import("../lib/desktopAuth");
                  const authData = await exchangeDesktopHandoffCode(rawUrl);
                  if (authData?.token) {
                    await loginWithToken(authData.token);
                  }
                } catch (err) {
                  console.error("Deep link token exchange failed:", err);
                }
              }
            }
          });
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("graffiti:auth:login", loginHandler);
    };
  }, [loginWithToken]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    const u: AuthUser = {
      userId: res.userId,
      email: res.email,
      name: res.name,
      avatarUrl: res.avatarUrl,
      provider: "LOCAL",
    };
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await apiRegister(email, password, name);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    const u: AuthUser = {
      userId: res.userId,
      email: res.email,
      name: res.name,
      avatarUrl: res.avatarUrl,
      provider: "LOCAL",
    };
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: user !== null,
        isLoading,
        login,
        register,
        loginWithToken,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
