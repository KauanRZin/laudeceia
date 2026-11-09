const { Prisma } = require("@prisma/client");
const prisma = require("../../database/client");
const AppError = require("../../utils/AppError");

// Ordem de inserção conforme as chaves estrangeiras. Os nomes usados no SQL vêm apenas daqui.
const tables = new Map(Object.entries({
  Vinculo: ["id", "nome"],
  InsuranceType: ["id", "nome"],
  User: ["id", "nome", "email", "passwordHash", "role", "status", "avatar", "createdAt", "updatedAt"],
  Client: ["id", "nome", "cpf", "telefone", "nascimento", "observacao", "endereco", "createdAt", "updatedAt"],
  Insurance: ["id", "clientId", "tipoId", "inicioVigencia", "fimVigencia", "vinculoId", "createdAt", "updatedAt"],
  _ClientVinculos: ["A", "B"],
  _UserVinculos: ["A", "B"],
  AuditLog: ["id", "action", "actorId", "actorName", "clientId", "clientName", "entityId", "summary", "before", "after", "createdAt"],
}));

const COPY_HEADER = /^COPY public\.(?:"(\w+)"|(\w+)) \(([^()]+)\) FROM stdin;$/;
const COPY_ESCAPES = { "\\": "\\", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" };
const JSON_COLUMNS = new Set(["endereco", "before", "after"]);

function invalidBackup(message = "Selecione um backup SQL completo e compatível, exportado pelo SeguraPro.") {
  return new AppError(message, 422, "INVALID_SQL_BACKUP");
}

function* lines(text) {
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf("\n", start);
    const end = newline < 0 ? text.length : newline;
    yield { start, end, line: text.slice(start, text[end - 1] === "\r" ? end - 1 : end) };
    start = end + 1;
  }
}

function parseBackup(file) {
  if (!Buffer.isBuffer(file) || !file.length) throw invalidBackup();
  let dump;
  try {
    dump = new TextDecoder("utf-8", { fatal: true }).decode(file);
  } catch {
    throw invalidBackup("O arquivo SQL precisa estar codificado em UTF-8.");
  }

  if (!/^--\r?\n-- PostgreSQL database dump\r?\n/.test(dump) || dump.includes("\0")) throw invalidBackup();
  const blocks = new Map();
  let block;
  let complete = false;

  for (const { start, end, line } of lines(dump)) {
    if (block) {
      if (line === "\\.") {
        blocks.set(block.name, { ...block, end: start });
        block = undefined;
      }
      continue;
    }
    if (line === "-- PostgreSQL database dump complete") complete = true;
    if (!line.startsWith("COPY ")) continue;

    const match = COPY_HEADER.exec(line);
    if (!match || complete) throw invalidBackup();
    const name = match[1] ?? match[2];
    const columns = match[3].split(", ").map(column => column.replace(/^"(\w+)"$/, "$1"));
    const expected = tables.get(name);
    if (blocks.has(name) || (name !== "_prisma_migrations" &&
        (!expected || expected.length !== columns.length || expected.some(column => !columns.includes(column))))) {
      throw invalidBackup();
    }
    block = { name, columns, start: end + 1 };
  }

  if (block || !complete || [...tables.keys()].some(name => !blocks.has(name))) throw invalidBackup();
  return { dump, blocks };
}

function decodeValue(value) {
  if (value === "\\N") return null;
  return value.replace(/\\(.|$)/g, (_, escape) => {
    if (!Object.hasOwn(COPY_ESCAPES, escape)) throw invalidBackup();
    return COPY_ESCAPES[escape];
  });
}

async function insertTable(tx, name, dump, block) {
  const table = Prisma.raw(`public."${name}"`);
  const names = tables.get(name);
  const columns = Prisma.join(names.map(column => Prisma.raw(`"${column}"`)));
  const values = Prisma.join(names.map(column => {
    const identifier = Prisma.raw(`"${column}"`);
    return JSON_COLUMNS.has(column) ? Prisma.sql`(${identifier} #>> '{}')::jsonb` : identifier;
  }));
  let batch = [];
  async function insertBatch() {
    // As colunas JSON chegam como texto do COPY e são decodificadas no banco para preservar a precisão numérica.
    await tx.$executeRaw`INSERT INTO ${table} (${columns}) SELECT ${values}
      FROM json_populate_recordset(NULL::${table}, ${JSON.stringify(batch)}::json)`;
    batch = [];
  }

  for (const { line } of lines(dump.slice(block.start, block.end))) {
    const fields = line.split("\t");
    if (fields.length !== block.columns.length) throw invalidBackup();
    batch.push(Object.fromEntries(block.columns.map((column, index) => [column, decodeValue(fields[index])])));
    if (batch.length === 500) await insertBatch();
  }
  if (batch.length) await insertBatch();
}

async function restoreDatabase(file, actorId) {
  const { dump, blocks } = parseBackup(file);
  try {
    await prisma.$transaction(async tx => {
      const [{ acquired }] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(18427, 40103) AS acquired`;
      if (!acquired) throw new AppError("Já existe uma restauração em andamento.", 409, "RESTORE_IN_PROGRESS");

      await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
      await tx.$executeRaw`LOCK TABLE public."User" IN ACCESS EXCLUSIVE MODE`;
      const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true, status: true } });
      if (actor?.role !== "SUPERADMIN" || actor.status !== "ATIVO") {
        throw new AppError("Somente um SuperAdmin ativo pode restaurar o banco.", 403, "RESTORE_FORBIDDEN");
      }

      const targets = Prisma.join([...tables.keys()].map(name => Prisma.raw(`public."${name}"`)));
      await tx.$executeRaw`TRUNCATE TABLE ${targets} RESTART IDENTITY`;
      for (const name of tables.keys()) await insertTable(tx, name, dump, blocks.get(name));

      if (!await tx.user.findFirst({ where: { role: "SUPERADMIN", status: "ATIVO" }, select: { id: true } })) {
        throw invalidBackup("O backup precisa conter pelo menos um SuperAdmin ativo.");
      }
      const { _max } = await tx.vinculo.aggregate({ _max: { id: true } });
      const nextId = Math.max(0, _max.id ?? 0) + 1;
      await tx.$executeRaw`ALTER SEQUENCE public."Vinculo_id_seq" RESTART WITH ${Prisma.raw(String(nextId))}`;
    }, { timeout: 120_000 });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const pgCode = error.code === "P2010" ? String(error.meta?.code ?? "") : "";
    if (pgCode.startsWith("22") || pgCode.startsWith("23")) {
      throw invalidBackup("O backup contém dados inválidos ou referências inconsistentes. A restauração foi desfeita.");
    }
    if (pgCode === "55P03" || pgCode === "40P01") {
      throw new AppError("O banco está ocupado. Tente restaurar novamente em instantes.", 409, "RESTORE_DATABASE_BUSY");
    }
    console.error("Falha ao restaurar backup SQL:", error.code ?? "RESTORE_FAILED", pgCode);
    throw new AppError("Não foi possível concluir a restauração do backup SQL.", 500, "RESTORE_FAILED");
  }
}

module.exports = { parseBackup, decodeValue, restoreDatabase };
