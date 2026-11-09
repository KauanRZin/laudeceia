import { isAxiosError } from "axios";
import type { User } from "../types/domain";
import { api } from "./http";

export async function getUsers() {
  const { data } = await api.get<User[]>("/users");
  return data;
}

export async function downloadDatabaseBackup() {
  try {
    const { data } = await api.get<Blob>("/users/database-backup", { responseType: "blob", timeout: 150_000 });
    return data;
  } catch (error) {
    const body = isAxiosError(error) ? error.response?.data : undefined;
    if (body instanceof Blob && body.type.includes("application/json")) {
      const payload = await body.text().then(JSON.parse).catch(() => null);
      if (typeof payload?.error?.message === "string") throw new Error(payload.error.message);
    }
    throw new Error("Não foi possível baixar o backup SQL.");
  }
}

export async function restoreDatabaseBackup(file: File) {
  await api.post("/users/database-backup", file, {
    headers: { "Content-Type": "application/sql", "X-Confirm-Restore": "replace" },
    timeout: 150_000,
  });
}

export async function saveUser(user: Partial<User> & { password?: string }) {
  const { data } = user.id ? await api.patch<User>(`/users/${user.id}`, user) : await api.post<User>("/users", user);
  return data;
}

export async function updateUserStatus(id: string, status: User["status"]) {
  const { data } = await api.patch<User>(`/users/${id}/status`, { status });
  return data;
}

export async function changeUserPassword(id: string, password: string) {
  const { data } = await api.patch<{ ok: boolean }>(`/users/${id}/password`, { password });
  return data;
}
