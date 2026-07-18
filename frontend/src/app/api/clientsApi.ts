import type { Client, Insurance } from "../types/domain";
import { api } from "./http";

export async function getClients() {
  const { data } = await api.get<Client[]>("/clients");
  return data;
}

export async function saveClient(client: Partial<Client>) {
  const { data } = client.id ? await api.patch<Client>(`/clients/${client.id}`, client) : await api.post<Client>("/clients", client);
  return data;
}

export async function deleteClient(id: string) {
  const { data } = await api.delete(`/clients/${id}`);
  return data;
}

export async function addInsurance(clientId: string, insurance: Partial<Insurance>) {
  const { data } = await api.post<Insurance>(`/clients/${clientId}/insurances`, insurance);
  return data;
}

export async function updateInsurance(clientId: string, insuranceId: string, data: Partial<Insurance>) {
  const { data: res } = await api.patch<Insurance>(`/clients/${clientId}/insurances/${insuranceId}`, data);
  return res;
}
