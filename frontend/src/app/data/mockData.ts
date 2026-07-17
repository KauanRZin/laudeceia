
import type { Client, RenewalRow, User } from "../types/domain";

export const VINCULOS = ["Seguradora X", "Escritório Y", "Agência 1", "Agência 2"];

export const INSURANCE_TYPES = [
  { id: 1, nome: "Seguro de Vida" },
  { id: 2, nome: "Seguro Residencial" },
  { id: 3, nome: "Seguro Auto" },
  { id: 4, nome: "Seguro Empresarial" },
];

export const USERS: User[] = [
  { id: "u1", nome: "Carlos Mendes", email: "gerente@seguradora.com", role: "Manager", vinculos: ["Seguradora X", "Escritório Y"], status: "Ativo" },
  { id: "u2", nome: "Ana Lima", email: "ana@seguradora.com", role: "Funcionário", vinculos: ["Agência 1"], status: "Ativo" },
  { id: "u3", nome: "Bruno Carvalho", email: "bruno@seguradora.com", role: "Funcionário", vinculos: ["Escritório Y"], status: "Ativo" },
  { id: "u4", nome: "Lucia Ferreira", email: "lucia@seguradora.com", role: "Funcionário", vinculos: ["Agência 1"], status: "Inativo" },
  { id: "u5", nome: "SuperAdmin", email: "admin@seguradora.com", role: "SuperAdmin", vinculos: [], status: "Ativo" },
];

export const CLIENTS: Client[] = [
  {
    id: "c1",
    nome: "João Pereira",
    cpf: "123.456.789-00",
    telefone: "(81) 99001-1234",
    nascimento: "1985-04-15",
    observacao: "Cliente desde 2018. Prefere contato por WhatsApp.",
    vinculos: ["Agência 1", "Escritório Y"],
    endereco: { cep: "51020-000", logradouro: "Rua das Flores", numero: "342", complemento: "Apto 12", bairro: "Boa Viagem", cidade: "Recife", estado: "PE" },
    seguros: [
      { id: "s1", tipoId: 1, tipoNome: "Seguro de Vida", inicioVigencia: "2025-01-01", fimVigencia: null, vinculoId: 3, vinculoNome: "Agência 1" },
      { id: "s2", tipoId: 2, tipoNome: "Seguro Residencial", inicioVigencia: "2024-03-15", fimVigencia: "2025-03-14", vinculoId: 2, vinculoNome: "Escritório Y" },
    ],
  },
  {
    id: "c2",
    nome: "Maria Souza",
    cpf: "987.654.321-00",
    telefone: "(81) 98765-4321",
    nascimento: "1990-08-22",
    observacao: "",
    vinculos: ["Escritório Y"],
    endereco: { cep: "50030-230", logradouro: "Rua do Sol", numero: "88", complemento: "", bairro: "Santo Antônio", cidade: "Recife", estado: "PE" },
    seguros: [{ id: "s3", tipoId: 2, tipoNome: "Seguro Residencial", inicioVigencia: "2025-01-10", fimVigencia: "2026-01-09", vinculoId: 2, vinculoNome: "Escritório Y" }],
  },
  {
    id: "c3",
    nome: "Carlos Lima",
    cpf: "111.222.333-44",
    telefone: "(81) 91234-5678",
    nascimento: "1978-11-05",
    observacao: "Renovação próxima.",
    vinculos: ["Agência 1"],
    endereco: { cep: "52011-020", logradouro: "Avenida Norte", numero: "1200", complemento: "Sala 4", bairro: "Encruzilhada", cidade: "Recife", estado: "PE" },
    seguros: [
      { id: "s4", tipoId: 3, tipoNome: "Seguro Auto", inicioVigencia: "2025-02-15", fimVigencia: "2026-02-14", vinculoId: 3, vinculoNome: "Agência 1" },
      { id: "s5", tipoId: 1, tipoNome: "Seguro de Vida", inicioVigencia: "2023-06-01", fimVigencia: null, vinculoId: 3, vinculoNome: "Agência 1" },
      { id: "s6", tipoId: 4, tipoNome: "Seguro Empresarial", inicioVigencia: "2024-08-01", fimVigencia: "2025-08-01", vinculoId: 3, vinculoNome: "Agência 1" },
    ],
  },
  {
    id: "c4",
    nome: "Fernanda Costa",
    cpf: "444.555.666-77",
    telefone: "(81) 99887-6655",
    nascimento: "1995-02-18",
    observacao: "",
    vinculos: ["Escritório Y"],
    endereco: { cep: "50050-000", logradouro: "Rua da Aurora", numero: "500", complemento: "", bairro: "Boa Vista", cidade: "Recife", estado: "PE" },
    seguros: [],
  },
  {
    id: "c5",
    nome: "Roberto Alves",
    cpf: "777.888.999-00",
    telefone: "(81) 97654-3210",
    nascimento: "1969-06-30",
    observacao: "Cliente estratégico para renovação.",
    vinculos: ["Seguradora X"],
    endereco: { cep: "52060-590", logradouro: "Rua Amélia", numero: "190", complemento: "", bairro: "Graças", cidade: "Recife", estado: "PE" },
    seguros: [
      { id: "s7", tipoId: 2, tipoNome: "Seguro Residencial", inicioVigencia: "2024-02-10", fimVigencia: "2025-02-10", vinculoId: 1, vinculoNome: "Seguradora X" },
      { id: "s8", tipoId: 3, tipoNome: "Seguro Auto", inicioVigencia: "2024-05-01", fimVigencia: "2025-05-01", vinculoId: 1, vinculoNome: "Seguradora X" },
    ],
  },
];

export const ACTIVE_RENEWALS: RenewalRow[] = [
  { cliente: "João Pereira", tipo: "Seguro de Vida", vinculo: "Agência 1", inicio: "2025-01-01", fim: null, status: "Ativo" },
  { cliente: "Carlos Lima", tipo: "Seguro Auto", vinculo: "Agência 1", inicio: "2025-02-15", fim: "2026-02-14", status: "Ativo" },
  { cliente: "Maria Souza", tipo: "Seguro Residencial", vinculo: "Escritório Y", inicio: "2025-01-10", fim: "2026-01-09", status: "Ativo" },
];

export const EXPIRING_RENEWALS: RenewalRow[] = [
  { cliente: "Roberto Alves", tipo: "Seguro Residencial", vinculo: "Seguradora X", fim: "2025-02-10", dias: 12, status: "Expirando" },
  { cliente: "Fernanda Costa", tipo: "Seguro Auto", vinculo: "Escritório Y", fim: "2025-02-28", dias: 28, status: "Expirando" },
  { cliente: "João Pereira", tipo: "Seguro Residencial", vinculo: "Agência 1", fim: "2025-03-14", dias: 42, status: "Expirando" },
];
