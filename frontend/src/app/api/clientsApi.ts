import type { Client, Insurance } from "../types/domain";
import { api } from "./http";

export async function getClients() {
  const { data } = await api.get<Client[]>("/clients");
  return data;
}

export async function getClient(id: string) {
  const { data } = await api.get<Client>(`/clients/${id}`);
  return data;
}

export type ClientExportField = "nascimento" | "cpf" | "telefone" | "endereco" | "observacao";

export type ClientExportFilters = {
  vinculo?: string;
  campos: ClientExportField[];
} & (
  { modo: "clientes" }
  | { modo: "seguros"; inicio: string; fim: string; criterio: "vigencia" | "vencimento"; tipoId?: number }
);

export interface ClientExportRow {
  cliente: Pick<Client, "nome"> & Partial<Pick<Client, ClientExportField>>;
  seguro?: Insurance;
}

export async function getClientsForExport(filters: ClientExportFilters) {
  const params = filters.modo === "clientes"
    ? { modo: filters.modo, vinculo: filters.vinculo, campos: filters.campos.join(",") }
    : { ...filters, campos: filters.campos.join(",") };
  const { data } = await api.get<ClientExportRow[]>("/clients/export", {
    params,
  });
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
export async function removeInsurance(clientId: string, insuranceId: string) {
  const { data } = await api.delete<{ success: boolean; client: Client }>(`/clients/${clientId}/insurances/${insuranceId}`);
  return data;
}
export async function importClientsSpreadsheet(payload: any) {
  // Ajuste a rota "/clients/import" para bater com o que você configurou no backend
  const { data } = await api.post("/clients/import", payload); 
  return data;
}
