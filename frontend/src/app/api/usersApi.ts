import type { User } from "../types/domain";
import { api } from "./http";

export async function getUsers() {
  const { data } = await api.get<User[]>("/users");
  return data;
}

export async function saveUser(user: Partial<User> & { password?: string }) {
  const { data } = user.id ? await api.put<User>(`/users/${user.id}`, user) : await api.post<User>("/users", user);
  return data;
}

export async function updateUserStatus(id: string, status: User["status"]) {
  const { data } = await api.patch<User>(`/users/${id}/status`, { status });
  return data;
}
