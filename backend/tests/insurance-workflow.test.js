const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");

test("fluxos de seguros em PostgreSQL isolado", { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const database = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(database.hostname));
  assert.ok(database.pathname.endsWith("_test"));
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET = "insurance-workflow-test-secret";
  process.env.NODE_ENV = "test";

  const prisma = require("../src/database/client");
  const jwt = require("jsonwebtoken");
  const app = require("../src/app");
  const config = require("../src/config/import");
  const { formatImportObservation } = require("../src/utils/serializers");
  const prefix = `regression-${Date.now()}`;
  const users = {};
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, role = "SUPERADMIN", method = "GET", body) => fetch(base + path, {
    method,
    headers: {
      ...(role && { Authorization: `Bearer ${jwt.sign({ sub: users[role].id }, process.env.JWT_SECRET)}` }),
      "Content-Type": "application/json",
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const inspect = id => prisma.client.findUnique({ where: { id }, include: { vinculos: true, seguros: true } });
  const importRows = async (tipo, segurados) => {
    const response = await request("/clients/import", "SUPERADMIN", "POST", { documento: { tipo }, segurados });
    assert.equal(response.status, 200);
    return response.json();
  };
  const name = `${prefix} João Teste`;
  const auto = year => ({ segurado: name, fim_vig: `16/10/${year}`, agencia: "1344", modelo: "Carro azul", placa: "ABC1D23" });
  let clientId;
  try {
    for (const role of ["SUPERADMIN", "MANAGER", "EMPLOYEE"]) {
      users[role] = await prisma.user.create({ data: { nome: prefix, email: `${role}-${prefix}@example.test`, passwordHash: "fixture", role } });
    }
    for (const nome of new Set([config.VINCULO_SEM_AGENCIA, config.VINCULO_PADRAO, ...Object.values(config.AGENCIAS).map(config.vinculoNomePorAgencia)])) {
      await prisma.vinculo.upsert({ where: { nome }, create: { nome }, update: {} });
    }
    for (const [id, nome] of [[1, "Seguro Vida"], [2, "Seguro RE"], [3, "Seguro Auto"]]) {
      await prisma.insuranceType.upsert({ where: { id }, create: { id, nome }, update: {} });
    }
    await t.test("importação mantém três por tipo e arquiva excedentes sem repetir", async () => {
      assert.equal((await importRows("Auto", [2027, 2023, 2026, 2025].map(auto))).erros.length, 0);
      clientId = (await prisma.client.findFirst({ where: { nome: name } })).id;
      const client = await inspect(clientId);
      assert.deepEqual(client.seguros.map(s => s.fimVigencia.getUTCFullYear()).sort(), [2025, 2026, 2027]);
      assert.match(client.observacao, /Seguro Auto\nModelo: Carro azul\nPlaca: ABC1D23/);
      assert.match(client.observacao, /Seguro anterior — Seguro Auto\nVigência: 16\/10\/2022 a 16\/10\/2023/);
      await importRows("Auto", [auto(2023), auto(2027)]);
      assert.equal((await inspect(clientId)).observacao, client.observacao);
    });
    await t.test("Auto e Vida usam o mesmo cliente e acrescentam o vínculo", async () => {
      const before = await inspect(clientId);
      const vida = { segurado: name.replace("João", "JOAO"), cpf: "12345678900", fim_vig: "16/10/2026" };
      assert.equal((await importRows("Vida", [vida, vida])).erros.length, 0);
      const after = await inspect(clientId);
      assert.equal(after.cpf, "123.456.789-00");
      assert.equal(after.seguros.filter(s => s.tipoId === 1).length, 1);
      assert.ok(before.seguros.every(s => after.seguros.some(next => next.id === s.id)));
      assert.ok(after.vinculos.some(v => v.nome === config.VINCULO_SEM_AGENCIA));
      assert.equal(after.vinculos.length, 2);
      assert.equal(await prisma.client.count({ where: { nome: { startsWith: prefix } } }), 1);
    });
    await t.test("datas impossíveis são rejeitadas sem gravação", async () => {
      const before = await inspect(clientId);
      const invalid = await importRows("Auto", [{ ...auto(2026), fim_vig: "31/02/2026" }]);
      assert.equal(invalid.erros.length, 1);
      assert.deepEqual(await inspect(clientId), before);
    });
    await t.test("exportação só de clientes dispensa período e limita os campos", async () => {
      const response = await request("/clients/export?modo=clientes&inicio=&fim=&campos=cpf", "MANAGER");
      assert.equal(response.status, 200);
      const rows = await response.json();
      const row = rows.find(item => item.cliente.nome === name);
      assert.deepEqual(Object.keys(row.cliente).sort(), ["cpf", "nome"]);
      assert.equal(Object.hasOwn(row, "seguro"), false);
      const forbidden = await request("/clients/export?modo=clientes", "EMPLOYEE");
      assert.equal(forbidden.status, 403);
      await forbidden.json();
    });
    await t.test("exportação por seguro aplica período e tipo no banco", async () => {
      const response = await request("/clients/export?modo=seguros&inicio=2026-10-16&fim=2026-10-16&criterio=vencimento&tipoId=3&campos=cpf");
      assert.equal(response.status, 200);
      const rows = (await response.json()).filter(row => row.cliente.nome === name);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].seguro.fimVigencia, "2026-10-16");
      const invalid = await request("/clients/export?modo=seguros&inicio=2026-11-01&fim=2026-01-01&criterio=vigencia");
      assert.equal(invalid.status, 400);
      await invalid.json();
    });
    await t.test("exclusões simultâneas removem só os seguros escolhidos", async () => {
      const before = await inspect(clientId);
      const targets = before.seguros.filter(s => s.tipoId === 3).slice(0, 2);
      const responses = await Promise.all(targets.map(s => request(`/clients/${clientId}/insurances/${s.id}`, "SUPERADMIN", "DELETE")));
      for (const response of responses) { assert.equal(response.status, 200); await response.json(); }
      const after = await inspect(clientId);
      assert.equal(after.observacao, before.observacao);
      assert.ok(after.seguros.some(s => s.tipoId === 1));
      const retry = await request(`/clients/${clientId}/insurances/${targets[0].id}`, "SUPERADMIN", "DELETE");
      assert.equal(retry.status, 404);
      await retry.json();
    });
    await t.test("formatação antiga preserva texto livre e é idempotente", () => {
      const old = "Nota livre | Importação: CPF genérico utilizado. Telefone genérico utilizado. | Seguro Auto - Modelo: Azul - Placa: ABC1D23";
      const formatted = formatImportObservation(old);
      assert.ok(formatted.startsWith("Nota livre\n\nImportação\n- CPF genérico"));
      assert.match(formatted, /Seguro Auto\nModelo: Azul\nPlaca: ABC1D23/);
      assert.equal(formatImportObservation(formatted), formatted);
    });
    await t.test("backup só para administrador gera SQL restaurável", async () => {
      for (const role of [null, "MANAGER", "EMPLOYEE"]) {
        const response = await request("/users/database-backup", role);
        assert.equal(response.status, role ? 403 : 401);
        await response.json();
      }
      const response = await request("/users/database-backup");
      assert.equal(response.status, 200);
      const sql = await response.text();
      assert.match(sql, /CREATE TABLE public\."Client"/);
      const env = { ...process.env, PGHOST: database.hostname, PGPORT: database.port || "5432", PGUSER: decodeURIComponent(database.username), PGPASSWORD: decodeURIComponent(database.password) };
      const restoreName = `restore_${Date.now()}_test`;
      execFileSync("createdb", [restoreName], { env });
      try {
        execFileSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", restoreName], { env, input: sql });
        assert.equal(execFileSync("psql", ["-X", "-At", "-d", restoreName, "-c", 'SELECT count(*) FROM "Client"'], { env, encoding: "utf8" }).trim(), "1");
      } finally { execFileSync("dropdb", [restoreName], { env }); }
    });
  } finally {
    await prisma.client.deleteMany({ where: { nome: { startsWith: prefix } } });
    await prisma.user.deleteMany({ where: { nome: prefix } });
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
});
