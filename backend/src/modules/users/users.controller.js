const { execFile } = require("node:child_process");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { promisify } = require("node:util");
const env = require("../../config/env");
const AppError = require("../../utils/AppError");
const service = require("./users.service");

const runPgDump = promisify(execFile);
let backupEmAndamento = false;

async function downloadDatabaseBackup(_req, res) {
  if (backupEmAndamento) {
    throw new AppError("Já existe uma exportação em andamento. Tente novamente em instantes.", 409, "BACKUP_IN_PROGRESS");
  }

  backupEmAndamento = true;
  let pastaTemporaria;
  const abort = new AbortController();
  const cancelar = () => abort.abort();
  res.once("close", cancelar);

  try {
    const banco = new URL(process.env.DATABASE_DUMP_URL || env.databaseUrl);
    if (!["postgres:", "postgresql:"].includes(banco.protocol) || !banco.hostname || banco.pathname.length <= 1 || !banco.username) {
      throw new Error("Configuração de banco inválida para o backup SQL.");
    }
    pastaTemporaria = await mkdtemp(join(tmpdir(), "segurapro-backup-"));
    const arquivo = join(pastaTemporaria, "backup.sql");

    // Use apenas os parâmetros de conexão do PostgreSQL. A URL do Prisma pode ter ?schema=public.
    await runPgDump("pg_dump", ["--format=plain", "--no-password", "--lock-wait-timeout=5000", "--file", arquivo], {
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PGHOST: banco.hostname.replace(/^\[|\]$/g, ""),
        PGPORT: banco.port || "5432",
        PGDATABASE: decodeURIComponent(banco.pathname.slice(1)),
        PGUSER: decodeURIComponent(banco.username),
        PGPASSWORD: decodeURIComponent(banco.password),
        PGSSLMODE: banco.searchParams.get("sslmode") || "prefer",
      },
      timeout: 120_000,
      signal: abort.signal,
      windowsHide: true,
    });

    if (res.destroyed) return;
    res.set("Cache-Control", "no-store");
    res.type("application/sql");
    const nome = `segurapro-backup-${new Date().toISOString().slice(0, 10)}.sql`;
    await new Promise((resolve, reject) => {
      res.download(arquivo, nome, (error) => error ? reject(error) : resolve());
    });
  } catch (error) {
    if (res.destroyed) return;
    if (res.headersSent) {
      res.destroy();
      return;
    }
    console.error("Falha ao exportar backup SQL:", error.code ?? "BACKUP_FAILED");
    throw new AppError("Não foi possível gerar o backup SQL.", 500, "BACKUP_FAILED");
  } finally {
    res.off("close", cancelar);
    if (pastaTemporaria) {
      await rm(pastaTemporaria, { recursive: true, force: true }).catch(() => {
        console.error("Falha ao limpar o arquivo temporário do backup SQL.");
      });
    }
    backupEmAndamento = false;
  }
}

async function list(req, res) {
  res.json(await service.list(req.user));
}

async function getById(req, res) {
  res.json(await service.getById(req.user, req.params.id));
}

async function create(req, res) {
  res.status(201).json(await service.create(req.user, req.validated.body));
}

async function update(req, res) {
  res.json(await service.update(req.user, req.params.id, req.validated.body));
}

async function updateStatus(req, res) {
  res.json(await service.updateStatus(req.user, req.params.id, req.validated.body.status));
}

async function updateMe(req, res) {
  res.json(await service.updateMe(req.user, req.validated.body));
}

module.exports = { list, getById, create, update, updateStatus, updateMe, downloadDatabaseBackup };
