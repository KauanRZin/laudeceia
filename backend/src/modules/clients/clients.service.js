const prisma = require("../../database/client");
const AppError = require("../../utils/AppError");
const { serializeClient, serializeInsurance, formatImportObservation } = require("../../utils/serializers");
const { importSpreadsheet, adicionarPlacaObservacao, manterTresSegurosRecentes } = require("./clients.import.service");
const { recordInsuranceEvent, recordClientEvent } = require("../audit/audit.service");

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

async function ensureClientAccess(user, id, db = prisma) {
  const client = await db.client.findUnique({ where: { id }, include: clientInclude });
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

async function findByInsuranceActivity(user, { inicio, fim, evento, tipoId, vinculo, page, pageSize }) {
  const start = new Date(`${inicio}T00:00:00-03:00`);
  const end = new Date(`${fim}T00:00:00-03:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  const range = { gte: start, lt: end };
  const periodo = evento === "criados" ? { createdAt: range }
    : evento === "atualizados" ? { updatedAt: range }
    : { OR: [{ createdAt: range }, { updatedAt: range }] };
  const segurosWhere = {
    ...periodo,
    ...(tipoId && { tipoId }),
    ...(vinculo && { vinculo: { nome: vinculo } }),
    ...(user.role === "EMPLOYEE" && { vinculoId: { in: userVinculoIds(user) } }),
  };
  const where = {
    seguros: { some: segurosWhere },
    ...(user.role === "EMPLOYEE" && { vinculos: { some: { id: { in: userVinculoIds(user) } } } }),
  };
  const [total, clients] = await prisma.$transaction([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      include: { vinculos: true, seguros: { where: segurosWhere, include: { tipo: true, vinculo: true }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] } },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, page, pageSize, items: clients.map(client => ({
    ...serializeClient(client),
    seguros: client.seguros.map(seguro => ({ ...serializeInsurance(seguro), createdAt: seguro.createdAt.toISOString(), updatedAt: seguro.updatedAt.toISOString() })),
  })) };
}

function serializeExportClient(client) {
  return {
    ...client,
    ...(client.observacao !== undefined && { observacao: formatImportObservation(client.observacao) }),
    ...(client.nascimento && { nascimento: client.nascimento.toISOString().slice(0, 10) }),
  };
}

async function findClientsForExport({ modo, inicio, fim, criterio, tipoId, vinculo, campos }) {
  const selecionarCliente = { nome: true, ...Object.fromEntries(campos.map((campo) => [campo, true])) };
  if (modo === "clientes") {
    const clientes = await prisma.client.findMany({
      where: {
        ...(vinculo && { vinculos: { some: { nome: vinculo } } }),
      },
      select: selecionarCliente,
      orderBy: [{ nome: "asc" }, { id: "asc" }],
    });
    return clientes.map(cliente => ({ cliente: serializeExportClient(cliente) }));
  }

  const dataInicial = new Date(`${inicio}T00:00:00Z`);
  const fimExclusivo = new Date(`${fim}T00:00:00Z`);
  fimExclusivo.setUTCDate(fimExclusivo.getUTCDate() + 1);

  const periodo = criterio === "vencimento"
    ? { fimVigencia: { gte: dataInicial, lt: fimExclusivo } }
    : {
        inicioVigencia: { lt: fimExclusivo },
        OR: [{ fimVigencia: { gte: dataInicial } }, { fimVigencia: null }],
      };

  const seguros = await prisma.insurance.findMany({
    where: {
      ...periodo,
      ...(tipoId && { tipoId }),
      ...(vinculo && { vinculo: { nome: vinculo } }),
    },
    include: {
      client: { select: selecionarCliente },
      tipo: true,
      vinculo: true,
    },
    orderBy: [{ client: { nome: "asc" } }, { inicioVigencia: "asc" }, { id: "asc" }],
  });

  return seguros.map(({ client, ...seguro }) => ({
    cliente: serializeExportClient(client),
    seguro: serializeInsurance(seguro),
  }));
}

async function getById(user, id) {
  return serializeClient(await ensureClientAccess(user, id));
}

async function create(user, data) {
  const vinculoNames = await resolveClientVinculos(user, data);
  const connect = await vinculoConnectByNames(vinculoNames);
  try {
    return await prisma.$transaction(async tx => {
      const client = await tx.client.create({
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
      await recordClientEvent(tx, user, "CLIENT_CREATED", undefined, client);
      return serializeClient(client);
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError("CPF já cadastrado", 409, "CPF_ALREADY_EXISTS", { cpf: "CPF já cadastrado" });
    }
    throw error;
  }
}

async function update(user, id, data) {
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Client" WHERE "id" = ${id} FOR NO KEY UPDATE`;
      const currentClient = await ensureClientAccess(user, id, tx);
      const vinculoNames = await resolveClientVinculos(user, data, currentClient);
      const connect = await vinculoConnectByNames(vinculoNames);
      const client = await tx.client.update({
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
      await recordClientEvent(tx, user, "CLIENT_UPDATED", currentClient, client);
      return serializeClient(client);
    });
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
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Client" WHERE "id" = ${id} FOR NO KEY UPDATE`;
    const client = await ensureClientAccess(user, id, tx);
    await recordClientEvent(tx, user, "CLIENT_DELETED", client);
    await tx.client.delete({ where: { id } });
    return { success: true };
  });
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
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Client" WHERE "id" = ${clientId} FOR NO KEY UPDATE`;
    const atual = await tx.client.findUnique({ where: { id: clientId } });
    const tipoDocumento = /\bauto\b/i.test(tipo.nome) ? "AUTO" : null;
    const observacao = adicionarPlacaObservacao(tipoDocumento, data.placa, atual.observacao, data.modelo);
    const insurance = await tx.insurance.create({
      data: {
        clientId,
        tipoId: data.tipoId,
        inicioVigencia: new Date(data.inicioVigencia),
        fimVigencia: tipo.id === 1 ? null : data.fimVigencia ? new Date(data.fimVigencia) : null,
        vinculoId: data.vinculoId,
      },
      include: { tipo: true, vinculo: true },
    });
    if (observacao !== atual.observacao) {
      await tx.client.update({ where: { id: clientId }, data: { observacao } });
    }
    await recordInsuranceEvent(tx, user, "INSURANCE_CREATED", undefined, insurance);
    await manterTresSegurosRecentes(tx, clientId, data.tipoId, user);
    return serializeInsurance(insurance);
  });
}

async function updateInsurance(user, clientId, insuranceId, data) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Client" WHERE "id" = ${clientId} FOR NO KEY UPDATE`;
    const client = await ensureClientAccess(user, clientId, tx);
    const current = await tx.insurance.findFirst({ where: { id: insuranceId, clientId }, include: { tipo: true, vinculo: true } });
    if (!current) throw new AppError("Seguro não encontrado", 404, "INSURANCE_NOT_FOUND");

    const nextData = {
      tipoId: data.tipoId === undefined ? current.tipoId : data.tipoId,
      vinculoId: data.vinculoId === undefined ? current.vinculoId : data.vinculoId,
      inicioVigencia: data.inicioVigencia === undefined ? current.inicioVigencia : new Date(data.inicioVigencia),
      fimVigencia: data.fimVigencia === undefined ? current.fimVigencia : data.fimVigencia,
    };
    const tipo = await validateInsuranceInput(user, client, nextData);

    const insurance = await tx.insurance.update({
      where: { id: insuranceId },
      data: {
        tipoId: nextData.tipoId,
        vinculoId: nextData.vinculoId,
        inicioVigencia: nextData.inicioVigencia,
        fimVigencia: tipo.id === 1 ? null : nextData.fimVigencia ? new Date(nextData.fimVigencia) : null,
      },
      include: { tipo: true, vinculo: true },
    });
    await recordInsuranceEvent(tx, user, "INSURANCE_UPDATED", current, insurance);
    return serializeInsurance(insurance);
  });
}

async function removeInsurance(user, clientId, insuranceId) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Client" WHERE "id" = ${clientId} FOR NO KEY UPDATE`;
    await ensureClientAccess(user, clientId, tx);
    const current = await tx.insurance.findFirst({
      where: { id: insuranceId, clientId },
      include: { tipo: true, vinculo: true },
    });
    if (!current) throw new AppError("Seguro não encontrado", 404, "INSURANCE_NOT_FOUND");
    if (user.role === "EMPLOYEE" && !userVinculoIds(user).includes(current.vinculoId)) {
      throw new AppError("Funcionário só pode remover seguro do próprio vínculo", 403, "FORBIDDEN_INSURANCE_VINCULO");
    }
    await recordInsuranceEvent(tx, user, "INSURANCE_DELETED", current);
    await tx.insurance.delete({ where: { id: insuranceId } });
    const client = await tx.client.findUnique({ where: { id: clientId }, include: clientInclude });
    return { success: true, client: serializeClient(client) };
  });
}

module.exports = {
  list,
  findByInsuranceActivity,
  findClientsForExport,
  getById,
  create,
  update,
  remove,
  addInsurance,
  updateInsurance,
  removeInsurance,
  importSpreadsheet
};
