const prisma = require("../../database/client");
const { isDeepStrictEqual } = require("node:util");
const { serializeClient } = require("../../utils/serializers");

function jsonSnapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

async function recordInsuranceEvent(db, user, action, before, after) {
  if (action === "INSURANCE_UPDATED" && isDeepStrictEqual({ ...before, updatedAt: undefined }, { ...after, updatedAt: undefined })) return;
  const seguro = after || before;
  const client = await db.client.findUnique({ where: { id: seguro.clientId }, select: { nome: true } });
  const descriptions = {
    INSURANCE_CREATED: "Seguro cadastrado",
    INSURANCE_UPDATED: "Seguro atualizado",
    INSURANCE_DELETED: "Seguro excluído",
    INSURANCE_ARCHIVED: "Seguro anterior transferido para as observações",
  };
  return db.auditLog.create({ data: {
    action,
    actorId: user?.id,
    actorName: user?.nome || "Sistema",
    clientId: seguro.clientId,
    clientName: client.nome,
    entityId: seguro.id,
    summary: `${descriptions[action]} — ${seguro.tipo.nome}, ${seguro.vinculo.nome}`,
    ...(before && { before: jsonSnapshot(before) }),
    ...(after && { after: jsonSnapshot(after) }),
  } });
}

function clientSnapshot(value) {
  if (!value) return undefined;
  const { seguros, ...client } = serializeClient(value);
  client.vinculos.sort();
  return client;
}

async function recordClientEvent(db, user, action, before, after) {
  const previous = clientSnapshot(before);
  const next = clientSnapshot(after);
  if (action === "CLIENT_UPDATED" && isDeepStrictEqual(previous, next)) return;
  const client = next || previous;
  const descriptions = { CLIENT_CREATED: "Cliente cadastrado", CLIENT_UPDATED: "Cliente atualizado", CLIENT_DELETED: "Cliente excluído" };
  await db.auditLog.create({ data: {
    action,
    actorId: user?.id,
    actorName: user?.nome || "Sistema",
    clientId: client.id,
    clientName: client.nome,
    entityId: client.id,
    summary: descriptions[action],
    ...(previous && { before: jsonSnapshot(previous) }),
    ...(next && { after: jsonSnapshot(next) }),
  } });
}

async function recordImportSummary(user, tipoDocumento) {
  const labels = { VIDA: "Vida", AUTO: "Auto", RE: "RE" };
  await prisma.auditLog.create({ data: {
    action: "IMPORT_COMPLETED",
    actorId: user?.id,
    actorName: user?.nome || "Sistema",
    summary: `Planilha de ${labels[tipoDocumento]} importada`,
  } });
}

async function listAuditLogs({ inicio, fim, action, page, pageSize }) {
  const start = new Date(`${inicio}T00:00:00-03:00`);
  const end = new Date(`${fim}T00:00:00-03:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  const where = { createdAt: { gte: start, lt: end }, ...(action && { action }) };
  const [total, items] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { total, items, page, pageSize };
}

module.exports = { recordInsuranceEvent, recordClientEvent, recordImportSummary, listAuditLogs };
