const ROLE_TO_API = {
  MANAGER: "Manager",
  EMPLOYEE: "Funcionário",
  SUPERADMIN: "SuperAdmin",
};

const ROLE_FROM_API = {
  Manager: "MANAGER",
  "Funcionário": "EMPLOYEE",
  Funcionario: "EMPLOYEE",
  Employee: "EMPLOYEE",
  SuperAdmin: "SUPERADMIN",
};

const STATUS_TO_API = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
};

const STATUS_FROM_API = {
  Ativo: "ATIVO",
  Inativo: "INATIVO",
};

function toDateOnly(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: ROLE_TO_API[user.role],
    vinculos: (user.vinculos || []).map((vinculo) => vinculo.nome),
    status: STATUS_TO_API[user.status],
    avatar: user.avatar || undefined,
  };
}

function serializeInsurance(insurance) {
  return {
    id: insurance.id,
    tipoId: insurance.tipoId,
    tipoNome: insurance.tipo.nome,
    inicioVigencia: toDateOnly(insurance.inicioVigencia),
    fimVigencia: toDateOnly(insurance.fimVigencia),
    vinculoId: insurance.vinculoId,
    vinculoNome: insurance.vinculo.nome,
  };
}

function serializeClient(client) {
  const vinculos = (client.vinculos || []).map((vinculo) => vinculo.nome);
  return {
    id: client.id,
    nome: client.nome,
    cpf: client.cpf,
    telefone: client.telefone,
    nascimento: toDateOnly(client.nascimento),
    observacao: client.observacao,
    endereco: client.endereco,
    vinculo: vinculos[0] || "",
    vinculos,
    seguros: (client.seguros || []).map(serializeInsurance),
  };
}

module.exports = {
  ROLE_TO_API,
  ROLE_FROM_API,
  STATUS_TO_API,
  STATUS_FROM_API,
  serializeUser,
  serializeClient,
  serializeInsurance,
};
