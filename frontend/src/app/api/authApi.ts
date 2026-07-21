import type { User } from "../types/domain";
import { api, TOKEN_KEY } from "./http";
import Cookies from "js-cookie";

export async function login(email: string, password: string) {
  const { data } = await api.post<{ accessToken: string; user: User }>("/auth/login", { email, password });
  Cookies.set(TOKEN_KEY, data.accessToken, { expires: 7, secure: true, sameSite: "strict" });
  return data;
}

export async function me() {
  const { data } = await api.get<User>("/auth/me");
  return data;
}

export function logout() {
  Cookies.remove(TOKEN_KEY, { secure: true, sameSite: "strict" });
}
