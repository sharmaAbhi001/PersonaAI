import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import {
  clearTokens,
  getRefreshToken,
  hasTokens,
  setTokens,
} from "@/lib/auth-tokens";

const AuthContext = createContext(null);

function parseUserFromMeResponse(response) {
  const body = response?.data;

  if (
    response?.status === 200 &&
    body?.success === true &&
    typeof body?.data?.user?.id === "string"
  ) {
    return body.data.user;
  }

  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    if (!hasTokens()) {
      setUser(null);
      return null;
    }

    try {
      const response = await api.get("/auth/me");
      const nextUser = parseUserFromMeResponse(response);
      setUser(nextUser);

      if (!nextUser) {
        clearTokens();
      }

      return nextUser;
    } catch {
      clearTokens();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshAuth().finally(() => setLoading(false));
  }, [refreshAuth]);

  const login = useCallback((authUser, tokens) => {
    if (tokens?.accessToken && tokens?.refreshToken) {
      setTokens(tokens);
    }

    if (authUser?.id) {
      setUser(authUser);
      return;
    }

    return refreshAuth();
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();

    try {
      await api.post("/auth/logout", refreshToken ? { refreshToken } : {});
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshAuth,
    }),
    [user, loading, login, logout, refreshAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
