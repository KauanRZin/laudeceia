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
    const before = await prisma.auditLog.count();
    const response = await request("/clients/import", "SUPERADMIN", "POST", { documento: { tipo }, segurados });
    assert.equal(response.status, 200);
    assert.equal(await prisma.auditLog.count(), before + 1, "Uma planilha deve produzir só um log");
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
    await t.test("cliente atualizado guarda antes e depois, sem repetir salvamentos iguais", async () => {
      const before = await inspect(clientId);
      const telefone = "(81) 99999-1234";
      const response = await request(`/clients/${clientId}`, "SUPERADMIN", "PATCH", { telefone });
      assert.equal(response.status, 200);
      await response.json();
      const logs = await prisma.auditLog.findMany({ where: { clientId, action: "CLIENT_UPDATED" } });
      assert.equal(logs.length, 1);
      assert.equal(logs[0].before.telefone, before.telefone);
      assert.equal(logs[0].after.telefone, telefone);
      assert.equal(Object.hasOwn(logs[0].before, "seguros"), false);
      const same = await request(`/clients/${clientId}`, "SUPERADMIN", "PATCH", { telefone });
      assert.equal(same.status, 200);
      await same.json();
      assert.equal(await prisma.auditLog.count({ where: { clientId, action: "CLIENT_UPDATED" } }), 1);
    });
    await t.test("cadastro manual registra cliente e importação guarda só o nome da planilha", async () => {
      const manual = await request("/clients", "SUPERADMIN", "POST", {
        nome: `${prefix} Manual`, cpf: "555.555.555-55", telefone: "(81) 99999-1111", nascimento: "1990-01-01",
        vinculos: [config.VINCULO_SEM_AGENCIA],
        endereco: { cep: "55555-555", logradouro: "Rua Teste", numero: "10", bairro: "Centro", cidade: "Teste", estado: "PE" },
      });
      assert.equal(manual.status, 201);
      const created = await manual.json();
      const log = await prisma.auditLog.findFirst({ where: { entityId: created.id, action: "CLIENT_CREATED" } });
      assert.equal(log.after.nome, `${prefix} Manual`);
      assert.equal(log.before, null);
      const branch = await prisma.vinculo.findUnique({ where: { nome: config.VINCULO_SEM_AGENCIA } });
      const added = await request(`/clients/${created.id}/insurances`, "SUPERADMIN", "POST", {
        tipoId: 3, vinculoId: branch.id, inicioVigencia: "2025-01-01", fimVigencia: "2026-01-01",
      });
      assert.equal(added.status, 201);
      const insurance = await added.json();
      const insuranceLog = await prisma.auditLog.findFirst({ where: { entityId: insurance.id, action: "INSURANCE_CREATED" } });
      assert.equal(insuranceLog.before, null);
      assert.equal(insuranceLog.after.tipo.nome, "Seguro Auto");
      const deleted = await request(`/clients/${created.id}`, "SUPERADMIN", "DELETE");
      assert.equal(deleted.status, 200);
      await deleted.json();
      const imports = await prisma.auditLog.findMany({ where: { action: "IMPORT_COMPLETED" } });
      assert.ok(imports.length > 0);
      for (const entry of imports) {
        assert.match(entry.summary, /^Planilha de (Vida|Auto|RE) importada$/);
        assert.equal(entry.before, null);
        assert.equal(entry.after, null);
        assert.equal(entry.clientId, null);
        assert.equal(entry.entityId, null);
      }
    });
    await t.test("busca por período usa criação e atualização, respeitando os vínculos", async () => {
      const client = await inspect(clientId);
      await prisma.client.update({ where: { id: clientId }, data: {
        observacao: `${client.observacao}\n\nSeguro Auto\nModelo: Carro mais recente\nPlaca: XYZ9A87`,
      } });
      const own = client.vinculos.find(v => v.nome.includes("Surubim"));
      const other = client.vinculos.find(v => v.id !== own.id);
      await prisma.user.update({ where: { id: users.EMPLOYEE.id }, data: { vinculos: { connect: { id: own.id } } } });
      const addFixture = (vinculoId, createdAt, updatedAt) => prisma.insurance.create({ data: {
        clientId, tipoId: 3, vinculoId, inicioVigencia: new Date("2025-01-01"), fimVigencia: new Date("2026-01-01"),
        createdAt: new Date(createdAt), updatedAt: new Date(updatedAt),
      } });
      const updated = await addFixture(own.id, "2020-01-01", "2026-11-01T03:00:00Z");
      const created = await addFixture(other.id, "2026-11-02T02:59:59Z", "2026-11-03T00:00:00Z");
      await addFixture(own.id, "2026-11-02T03:00:00Z", "2026-11-02T03:00:00Z");
      await addFixture(own.id, "2026-11-01T02:59:59Z", "2026-11-01T02:59:59Z");
      const url = "/clients/activity?inicio=2026-11-01&fim=2026-11-01&tipoId=3";
      const admin = await request(url);
      assert.equal(admin.status, 200);
      const all = await admin.json();
      assert.equal(all.total, 1);
      assert.equal(all.items[0].cpf, "123.456.789-00");
      assert.match(all.items[0].observacao, /Placa: XYZ9A87/);
      assert.deepEqual(all.items[0].seguros.map(s => s.id).sort(), [created.id, updated.id].sort());
      const employee = await (await request(url, "EMPLOYEE")).json();
      assert.equal(employee.total, 1);
      assert.match(employee.items[0].observacao, /Placa: XYZ9A87/);
      assert.deepEqual(employee.items[0].seguros.map(s => s.id), [updated.id]);
      const creation = await (await request(url + "&evento=criados")).json();
      assert.deepEqual(creation.items[0].seguros.map(s => s.id), [created.id]);
      const invalid = await request(url + "&page=0");
      assert.equal(invalid.status, 400);
      await invalid.json();
    });
    await t.test("logs protegem snapshots de exclusão e têm paginação estável", async () => {
      const url = "/audit-logs?inicio=2000-01-01&fim=2099-12-31";
      for (const role of [null, "MANAGER", "EMPLOYEE"]) {
        const response = await request(url, role);
        assert.equal(response.status, role ? 403 : 401);
        await response.json();
      }
      const deleted = await (await request(url + "&action=INSURANCE_DELETED")).json();
      assert.equal(deleted.total, 2);
      for (const entry of deleted.items) {
        assert.equal(entry.actorId, users.SUPERADMIN.id);
        assert.equal(entry.clientName, name);
        assert.equal(entry.before.id, entry.entityId);
        assert.equal(entry.before.tipo.nome, "Seguro Auto");
        assert.equal(await prisma.insurance.findUnique({ where: { id: entry.entityId } }), null);
      }
      const pageOne = await (await request(url + "&pageSize=2")).json();
      const pageTwo = await (await request(url + "&pageSize=2&page=2")).json();
      assert.equal(pageOne.items.length, 2);
      assert.ok(pageTwo.items.every(row => !pageOne.items.some(other => other.id === row.id)));
    });
    await t.test("alteração manual de seguro guarda os valores anteriores e novos", async () => {
      const policy = (await inspect(clientId)).seguros.find(s => s.tipoId === 3);
      const response = await request(`/clients/${clientId}/insurances/${policy.id}`, "SUPERADMIN", "PATCH", { fimVigencia: "2028-11-10" });
      assert.equal(response.status, 200);
      await response.json();
      const logs = await prisma.auditLog.findMany({ where: { entityId: policy.id, action: "INSURANCE_UPDATED" } });
      assert.equal(logs.length, 1);
      assert.equal(logs[0].before.fimVigencia, policy.fimVigencia.toISOString());
      assert.equal(logs[0].after.fimVigencia, "2028-11-10T00:00:00.000Z");
      const same = await request(`/clients/${clientId}/insurances/${policy.id}`, "SUPERADMIN", "PATCH", { fimVigencia: "2028-11-10" });
      assert.equal(same.status, 200);
      await same.json();
      assert.equal(await prisma.auditLog.count({ where: { entityId: policy.id, action: "INSURANCE_UPDATED" } }), 1);
    });
    await t.test("falha na exclusão desfaz também a gravação do log", async () => {
      const insurance = (await inspect(clientId)).seguros[0];
      const before = await prisma.auditLog.count();
      await prisma.$executeRawUnsafe("CREATE FUNCTION regression_delete_fail() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Synthetic test failure'; END; $$ LANGUAGE plpgsql");
      await prisma.$executeRawUnsafe('CREATE TRIGGER regression_delete_fail BEFORE DELETE ON "Insurance" FOR EACH ROW EXECUTE FUNCTION regression_delete_fail()');
      try {
        const response = await request(`/clients/${clientId}/insurances/${insurance.id}`, "SUPERADMIN", "DELETE");
        assert.equal(response.status, 500);
        await response.json();
        assert.equal(await prisma.auditLog.count(), before);
        assert.ok(await prisma.insurance.findUnique({ where: { id: insurance.id } }));
      } finally {
        await prisma.$executeRawUnsafe('DROP TRIGGER regression_delete_fail ON "Insurance"');
        await prisma.$executeRawUnsafe("DROP FUNCTION regression_delete_fail()");
      }
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
    await t.test("logs persistem depois da exclusão do cliente", async () => {
      const before = await prisma.auditLog.count({ where: { clientId } });
      const insuranceLogs = await prisma.auditLog.count({ where: { clientId, action: "INSURANCE_DELETED" } });
      const response = await request(`/clients/${clientId}`, "SUPERADMIN", "DELETE");
      assert.equal(response.status, 200);
      await response.json();
      assert.equal(await prisma.client.findUnique({ where: { id: clientId } }), null);
      assert.equal(await prisma.auditLog.count({ where: { clientId } }), before + 1);
      assert.equal(await prisma.auditLog.count({ where: { clientId, action: "INSURANCE_DELETED" } }), insuranceLogs);
      const log = await prisma.auditLog.findFirst({ where: { clientId, action: "CLIENT_DELETED" } });
      assert.equal(log.before.nome, name);
      assert.equal(log.before.cpf, "123.456.789-00");
      assert.equal(log.after, null);
    });
  } finally {
    await prisma.client.deleteMany({ where: { nome: { startsWith: prefix } } });
    await prisma.user.deleteMany({ where: { nome: prefix } });
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
});
