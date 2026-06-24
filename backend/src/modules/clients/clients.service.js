const prisma = require("../../database/client");
const AppError = require("../../utils/AppError");
const { serializeClient, serializeInsurance } = require("../../utils/serializers");

const clientInclude = {
  vinculos: true,
  seguros: { include: { tipo: true, vinculo: true }, orderBy: { createdAt: "asc" } },
};

function userVinculoIds(user) {
  return user.vinculos.map((vinculo) => vinculo.id);
}

function canSeeClient(user, client) {
  if (user.role !== "EMPLOYEE") return true;
  const allowed = new Set(userVinculoIds(user));
  return client.vinculos.some((vinculo) => allowed.has(vinculo.id));
}

function requestedVinculoNames(data) {
  if (Array.isArray(data.vinculos)) return data.vinculos;
  if (data.vinculo) return [data.vinculo];
  return undefined;
}

async function resolveClientVinculos(user, data, currentClient) {
  const requestedNames = requestedVinculoNames(data);

  if (user.role === "EMPLOYEE") {
    if (requestedNames && requestedNames.length > 1) {
      throw new AppError("Funcionário não pode atribuir segundo vínculo ao cliente", 403, "FORBIDDEN_SECOND_VINCULO");
    }

    const employeeNames = user.vinculos.map((vinculo) => vinculo.nome);
    const names = requestedNames || (currentClient ? currentClient.vinculos.map((vinculo) => vinculo.nome) : [employeeNames[0]]);
    if (!names.length || names.some((name) => !employeeNames.includes(name))) {
      throw new AppError("Funcionário só pode usar o próprio vínculo", 403, "FORBIDDEN_VINCULO");
    }
    return names;
  }

  const names = requestedNames || (currentClient ? currentClient.vinculos.map((vinculo) => vinculo.nome) : []);
  if (!names.length) {
    throw new AppError("Informe ao menos um vínculo", 400, "VINCULO_REQUIRED", { vinculos: "Informe ao menos um vínculo" });
  }
  if (names.length > 2) {
    throw new AppError("Cliente pode ter no máximo dois vínculos", 400, "MAX_CLIENT_VINCULOS", { vinculos: "Máximo de dois vínculos" });
  }
  return names;
}

async function vinculoConnectByNames(names) {
  const uniqueNames = [...new Set(names)];
  const vinculos = await prisma.vinculo.findMany({ where: { nome: { in: uniqueNames } } });
  if (vinculos.length !== uniqueNames.length) {
    throw new AppError("Vínculo inválido", 400, "INVALID_VINCULO", { vinculos: "Um ou mais vínculos não existem" });
  }
  return vinculos.map((vinculo) => ({ id: vinculo.id }));
}

async function ensureClientAccess(user, id) {
  const client = await prisma.client.findUnique({ where: { id }, include: clientInclude });
  if (!client) throw new AppError("Cliente não encontrado", 404, "CLIENT_NOT_FOUND");
  if (!canSeeClient(user, client)) {
    throw new AppError("Você não tem permissão para acessar este cliente", 403, "FORBIDDEN_CLIENT");
  }
  return client;
}

async function list(user) {
  const where = user.role === "EMPLOYEE" ? { vinculos: { some: { id: { in: userVinculoIds(user) } } } } : {};
  const clients = await prisma.client.findMany({
    where,
    include: clientInclude,
    orderBy: { nome: "asc" },
  });
  return clients.map(serializeClient);
}

async function getById(user, id) {
  return serializeClient(await ensureClientAccess(user, id));
}

async function create(user, data) {
  const vinculoNames = await resolveClientVinculos(user, data);
  const connect = await vinculoConnectByNames(vinculoNames);
  try {
    const client = await prisma.client.create({
      data: {
        nome: data.nome,
        cpf: data.cpf,
        telefone: data.telefone,
        nascimento: new Date(data.nascimento),
        observacao: data.observacao || "",
        endereco: data.endereco,
        vinculos: { connect },
      },
      include: clientInclude,
    });
    return serializeClient(client);
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError("CPF já cadastrado", 409, "CPF_ALREADY_EXISTS", { cpf: "CPF já cadastrado" });
    }
    throw error;
  }
}

async function update(user, id, data) {
  const currentClient = await ensureClientAccess(user, id);
  const vinculoNames = await resolveClientVinculos(user, data, currentClient);
  const connect = await vinculoConnectByNames(vinculoNames);

  try {
    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.cpf !== undefined && { cpf: data.cpf }),
        ...(data.telefone !== undefined && { telefone: data.telefone }),
        ...(data.nascimento !== undefined && { nascimento: new Date(data.nascimento) }),
        ...(data.observacao !== undefined && { observacao: data.observacao }),
        ...(data.endereco !== undefined && { endereco: data.endereco }),
        vinculos: { set: connect },
      },
      include: clientInclude,
    });
    return serializeClient(client);
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError("CPF já cadastrado", 409, "CPF_ALREADY_EXISTS", { cpf: "CPF já cadastrado" });
    }
    throw error;
  }
}

async function remove(user, id) {
  if (user.role === "EMPLOYEE") {
    throw new AppError("Funcionário não pode excluir clientes", 403, "FORBIDDEN_DELETE_CLIENT");
  }
  await ensureClientAccess(user, id);
  await prisma.client.delete({ where: { id } });
  return { success: true };
}

async function validateInsuranceInput(user, client, data) {
  const tipo = await prisma.insuranceType.findUnique({ where: { id: data.tipoId } });
  if (!tipo) throw new AppError("Tipo de seguro não encontrado", 400, "INVALID_INSURANCE_TYPE", { tipoId: "Tipo inválido" });

  const clientVinculoIds = client.vinculos.map((vinculo) => vinculo.id);
  if (!clientVinculoIds.includes(data.vinculoId)) {
    throw new AppError("Seguro deve usar um vínculo do cliente", 400, "INSURANCE_VINCULO_NOT_IN_CLIENT", { vinculoId: "Vínculo não pertence ao cliente" });
  }

  if (user.role === "EMPLOYEE" && !userVinculoIds(user).includes(data.vinculoId)) {
    throw new AppError("Funcionário só pode cadastrar seguro no próprio vínculo", 403, "FORBIDDEN_INSURANCE_VINCULO");
  }

  return tipo;
}

async function addInsurance(user, clientId, data) {
  const client = await ensureClientAccess(user, clientId);
  const tipo = await validateInsuranceInput(user, client, data);
  const insurance = await prisma.insurance.create({
    data: {
      clientId,
      tipoId: data.tipoId,
      inicioVigencia: new Date(data.inicioVigencia),
      fimVigencia: tipo.id === 1 ? null : data.fimVigencia ? new Date(data.fimVigencia) : null,
      vinculoId: data.vinculoId,
    },
    include: { tipo: true, vinculo: true },
  });
  return serializeInsurance(insurance);
}

async function updateInsurance(user, clientId, insuranceId, data) {
  const client = await ensureClientAccess(user, clientId);
  const current = await prisma.insurance.findFirst({ where: { id: insuranceId, clientId }, include: { tipo: true, vinculo: true } });
  if (!current) throw new AppError("Seguro não encontrado", 404, "INSURANCE_NOT_FOUND");

  const nextData = {
    tipoId: data.tipoId === undefined ? current.tipoId : data.tipoId,
    vinculoId: data.vinculoId === undefined ? current.vinculoId : data.vinculoId,
    inicioVigencia: data.inicioVigencia === undefined ? current.inicioVigencia : new Date(data.inicioVigencia),
    fimVigencia: data.fimVigencia === undefined ? current.fimVigencia : data.fimVigencia,
  };
  const tipo = await validateInsuranceInput(user, client, nextData);

  const insurance = await prisma.insurance.update({
    where: { id: insuranceId },
    data: {
      tipoId: nextData.tipoId,
      vinculoId: nextData.vinculoId,
      inicioVigencia: nextData.inicioVigencia,
      fimVigencia: tipo.id === 1 ? null : nextData.fimVigencia ? new Date(nextData.fimVigencia) : null,
    },
    include: { tipo: true, vinculo: true },
  });
  return serializeInsurance(insurance);
}

async function removeInsurance(user, clientId, insuranceId) {
  await ensureClientAccess(user, clientId);
  const current = await prisma.insurance.findFirst({ where: { id: insuranceId, clientId } });
  if (!current) throw new AppError("Seguro não encontrado", 404, "INSURANCE_NOT_FOUND");
  if (user.role === "EMPLOYEE" && !userVinculoIds(user).includes(current.vinculoId)) {
    throw new AppError("Funcionário só pode remover seguro do próprio vínculo", 403, "FORBIDDEN_INSURANCE_VINCULO");
  }
  await prisma.insurance.delete({ where: { id: insuranceId } });
  return { success: true };
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  addInsurance,
  updateInsurance,
  removeInsurance,
};
