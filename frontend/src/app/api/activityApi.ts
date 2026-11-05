import type { Client, Insurance } from "../types/domain";
import { api } from "./http";

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PeriodQuery {
  inicio: string;
  fim: string;
  page: number;
}

export interface ClientActivityQuery extends PeriodQuery {
  evento: "todos" | "criados" | "atualizados";
  tipoId?: number;
  vinculo?: string;
}

export type ActivityClient = Omit<Client, "seguros"> & {
  seguros: (Insurance & { createdAt: string; updatedAt: string })[];
};

export const auditActions = {
  CLIENT_CREATED: "Cliente cadastrado",
  CLIENT_UPDATED: "Cliente atualizado",
  CLIENT_DELETED: "Cliente excluído",
  INSURANCE_CREATED: "Seguro cadastrado",
  INSURANCE_UPDATED: "Seguro atualizado",
  INSURANCE_DELETED: "Seguro excluído",
  INSURANCE_ARCHIVED: "Seguro anterior arquivado",
  IMPORT_COMPLETED: "Importação concluída",
} as const;

export interface AuditQuery extends PeriodQuery {
  action?: keyof typeof auditActions;
}

export interface AuditEntry {
  id: string;
  action: keyof typeof auditActions;
  actorName: string;
  clientName: string | null;
  entityId: string | null;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export async function getClientActivity(query: ClientActivityQuery, signal: AbortSignal) {
  const { data } = await api.get<PageResult<ActivityClient>>("/clients/activity", { params: query, signal });
  return data;
}

export async function getAuditLogs(query: AuditQuery, signal: AbortSignal) {
  const { data } = await api.get<PageResult<AuditEntry>>("/audit-logs", { params: query, signal });
  return data;
}
