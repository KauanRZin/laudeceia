export type Role = "Manager" | "Funcionário" | "SuperAdmin";
export type Status = "Ativo" | "Inativo";
export type Screen =
  | "login"
  | "dashboard"
  | "clients"
  | "clientForm"
  | "clientProfile"
  | "users"
  | "userForm"
  | "profile";

export interface Insurance {
  id: string;
  tipoId: number;
  tipoNome: string;
  inicioVigencia: string;
  fimVigencia: string | null;
  vinculoId: number;
  vinculoNome: string;
}

export interface Address {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export interface Client {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  nascimento: string;
  observacao: string;
  endereco: Address;
  vinculos: string[];
  seguros: Insurance[];
}

export interface User {
  id: string;
  nome: string;
  email: string;
  password: string;
  role: Role;
  vinculos: string[];
  status: Status;
  avatar?: string;
}

export interface RenewalRow {
  cliente: string;
  tipo: string;
  vinculo: string;
  inicio?: string;
  fim: string | null;
  dias?: number;
  status: "Ativo" | "Expirando" | "Expirado";
}
