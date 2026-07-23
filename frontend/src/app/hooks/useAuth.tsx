import { useState, useEffect } from "react";
import type { User } from "../types/domain";
import * as authApi from "../api/authApi";
import { TOKEN_KEY } from "../api/http";
import { normalizeApiError } from "../api/http";
import Cookies from "js-cookie";


export function useAuth(notify: (msg: string) => void) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = Cookies.get(TOKEN_KEY);
    if (!token) {
      setAuthChecked(true);
      return;
    }
    authApi
      .me()
      .then(setCurrentUser)
      .catch(() => authApi.logout())
      .finally(() => setAuthChecked(true));
  }, []);

  async function login(email: string, password: string) {
    try {
      const response = await authApi.login(email, password);
      setCurrentUser(response.user);
    } catch (error: any) {
      notify(normalizeApiError(error).message);
    }
  }

  function logout() {
    authApi.logout();
    setCurrentUser(null);
  }

  return { currentUser, setCurrentUser, authChecked, login, logout };
}