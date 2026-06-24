import type { User } from "../types/domain";
import { api, TOKEN_KEY } from "./http";

export async function login(email: string, password: string) {
  const { data } = await api.post<{ accessToken: string; user: User }>("/auth/login", { email, password });
  localStorage.setItem(TOKEN_KEY, data.accessToken);
  return data;
}

export async function me() {
  const { data } = await api.get<User>("/auth/me");
  return data;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}
