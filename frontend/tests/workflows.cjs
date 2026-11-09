const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const XLSX = require("xlsx");

function load(relativePath, dependencies, extra = "") {
  const source = fs.readFileSync(path.join(__dirname, "../src/app", relativePath), "utf8");
  const code = ts.transpileModule(source + extra, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => dependencies[name] || {} });
  return exports;
}

test("importação de backup envia o arquivo SQL original e a confirmação de substituição", async () => {
  const calls = [];
  const { restoreDatabaseBackup } = load("api/usersApi.ts", {
    "./http": { api: { post: async (...args) => calls.push(args) } },
  });
  const file = new Blob(["-- PostgreSQL database dump"], { type: "application/sql" });
  await restoreDatabaseBackup(file);
  assert.equal(calls.length, 1);
  const [route, body, options] = calls[0];
  assert.equal(route, "/users/database-backup");
  assert.equal(body, file);
  assert.equal(options.headers["Content-Type"], "application/sql");
  assert.equal(options.headers["X-Confirm-Restore"], "replace");
});

test("extração lê os dados deslocados em AH e AQ", () => {
  const { processarPlanilha } = load("components/importSistem.tsx", { xlsx: XLSX }, "\nexport { processarPlanilha };");
  const header = ["Segurado", "Apólice", "Fim da vigência", "Agência"];
  header[XLSX.utils.decode_col("AJ")] = "Veículo";
  header[XLSX.utils.decode_col("AO")] = "Placa";
  const row = ["Pessoa Teste", "42", "16/10/2026", "1344"];
  row[XLSX.utils.decode_col("AH")] = "Carro azul";
  row[XLSX.utils.decode_col("AQ")] = "ABC-1234";
  const aba = XLSX.utils.aoa_to_sheet([header, row]);
  const result = processarPlanilha(XLSX.utils.sheet_to_json(aba, { header: 1, raw: false, defval: null }), aba);
  assert.equal(result.segurados[0].modelo, "Carro azul");
  assert.equal(result.segurados[0].placa, "ABC-1234");
  assert.equal(result.segurados[0].agencia, "1344");
});

test("Excel só de clientes mantém CPF e omite colunas de seguro", () => {
  let saved;
  const { exportarClientes } = load("modals/ExportClientsModal.tsx", {
    "xlsx": { ...XLSX, writeFile: (book, name) => { saved = { name, bytes: XLSX.write(book, { type: "buffer", bookType: "xlsx" }) }; } },
    "../utils/format": { formatDate: value => value || "—" },
  }, "\nexport { exportarClientes };");
  exportarClientes([{ cliente: { nome: "Ana", cpf: "00123456789" } }], { modo: "clientes", campos: ["cpf"] });
  assert.equal(saved.name, "clientes.xlsx");
  const rows = XLSX.utils.sheet_to_json(XLSX.read(saved.bytes).Sheets.Clientes);
  assert.deepEqual(rows, [{ Nome: "Ana", CPF: "00123456789" }]);
});

test("dashboard ordena a lista completa antes de paginar", () => {
  let cursor = 0;
  const states = [];
  const jsx = (type, props) => ({ type, props });
  const { RenewalTable } = load("screens/Dashboard.tsx", {
    react: {
      useEffect() {},
      useMemo: fn => fn(),
      useState(value) {
        const index = cursor++;
        if (!(index in states)) states[index] = value;
        return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "../components/SharedUI": { IconButton: "IconButton" },
    "../utils/format": { formatDate: value => value },
  }, "\nexport { RenewalTable };");
  const rows = [["Ana", 9], ["Beatriz", 12], ["Carlos", 1], ["Diego", 0], ["Eva", -3], ["Fabio", 2], ["Gabi", 8], ["Hugo", 5], ["Iara", 4], ["Joao", -1], ["Zelia", 11], ["Yara", 6]]
    .map(([cliente, dias], index) => ({ cliente, dias, clientId: index, seguroId: index, fim: new Date(Date.UTC(2026, 10, 15 + dias)).toISOString().slice(0, 10) }));
  function render() { cursor = 0; return RenewalTable({ title: "Teste", rows, mode: "expiring" }); }
  function walk(tree, predicate) {
    if (Array.isArray(tree)) return tree.flatMap(node => walk(node, predicate));
    if (!tree || typeof tree !== "object") return [];
    return [...(predicate(tree) ? [tree] : []), ...walk(tree.props?.children, predicate)];
  }
  const names = tree => walk(tree, node => node.type === "tbody")[0].props.children.map(row => row.props.children[0].props.children);
  function click(tree, label) {
    const node = walk(tree, node => node.props?.label === label || (node.type === "button" && node.props.children[0] === label))[0];
    node.props.onClick();
    return render();
  }
  let tree = render();
  assert.equal(names(tree).join(","), "Diego,Carlos,Fabio,Iara,Hugo,Yara,Gabi,Ana");
  tree = click(tree, "Próxima");
  assert.equal(names(tree).join(","), "Zelia,Beatriz,Joao,Eva");
  tree = click(tree, "Cliente");
  assert.equal(names(tree)[0], "Zelia");
  tree = click(tree, "Cliente");
  assert.equal(names(tree)[0], "Ana");
  tree = click(tree, "Fim");
  assert.equal(names(tree)[0], "Beatriz");
  tree = click(tree, "Dias restantes");
  assert.equal(names(tree)[0], "Beatriz");
  tree = click(tree, "Dias restantes");
  assert.equal(names(tree)[0], "Eva");
});

test("log compara campos alterados de cliente e mostra dados antigos da entidade excluída", () => {
  const { getAuditDetails } = load("screens/AuditLogScreen.tsx", {
    "../utils/format": { formatDate: value => value },
  });
  const normalize = value => JSON.parse(JSON.stringify(value));
  const changed = getAuditDetails({
    action: "CLIENT_UPDATED",
    before: { nome: "Ana", telefone: "11111111", endereco: { cidade: "Recife" } },
    after: { nome: "Ana", telefone: "22222222", endereco: { cidade: "Recife" } },
  });
  assert.deepEqual(normalize(changed), [{ path: "telefone", label: "Telefone", before: "11111111", after: "22222222" }]);
  const deletedClient = getAuditDetails({ action: "CLIENT_DELETED", before: { nome: "Ana", cpf: "00123456789" }, after: null });
  assert.equal(deletedClient.find(row => row.path === "cpf").before, "00123456789");
  assert.equal(deletedClient.some(row => row.path === "tipo.nome"), false);
  const deletedPolicy = getAuditDetails({ action: "INSURANCE_DELETED", before: { tipo: { nome: "Seguro Vida" }, inicioVigencia: "2026-01-01", fimVigencia: null }, after: null });
  assert.equal(deletedPolicy.find(row => row.path === "tipo.nome").before, "Seguro Vida");
  assert.equal(deletedPolicy.find(row => row.path === "fimVigencia").before, "Sem vencimento");
  assert.equal(getAuditDetails({ action: "IMPORT_COMPLETED", before: null, after: { nome: "Dados de um log antigo" } }).length, 0);
});

test("placa é extraída diretamente da observação em formatos antigos e com quebras do Windows", () => {
  const { latestVehiclePlate } = load("utils/format.ts", {});
  const cases = [
    [null, null],
    ["Placa: ausente", null],
    ["Observação livre", null],
    ["Placa: ABC-1234", "ABC1234"],
    ["Modelo: Azul - placa do veículo: abc1d23", "ABC1D23"],
    ["Seguro Auto\r\nModelo: Carro azul\r\nPlaca: SOP7I82", "SOP7I82"],
    ["Importação: CPF genérico utilizado. | Seguro Auto - Modelo: Azul - Placa: SOP7I82 | Seguro Auto - Modelo: Branco - Placa: SNL0H16", "SNL0H16"],
    ["Seguro Auto\nModelo: Azul\nPlaca: SOP7I82\n\nSeguro anterior — Seguro Auto\nPlaca: ANT0000", "SOP7I82"],
    ["Seguro anterior — Seguro Auto\nPlaca: ANT0000", "ANT0000"],
    ["Seguro Auto\nPlaca: SOP7I82\n\nSeguro Auto\nModelo: Sem placa informada", "SOP7I82"],
  ];
  for (const [value, expected] of cases) assert.equal(latestVehiclePlate(value), expected, String(value));
});

test("tela por período mostra a placa da observação mesmo sem campo adicional na resposta", () => {
  const format = load("utils/format.ts", {});
  let stateIndex = 0;
  const result = { items: [{
    id: "client", nome: "Pessoa Teste", cpf: "123.456.789-00",
    observacao: "Seguro Auto\r\nModelo: Carro azul\r\nPlaca: SOP7I82", seguros: [],
  }], total: 1, page: 1, pageSize: 20 };
  const jsx = (type, props) => ({ type, props });
  const { ClientPeriodSearch } = load("screens/ClientPeriodSearch.tsx", {
    react: { useEffect() {}, useState: initial => {
      const index = stateIndex++;
      return [index === 5 ? { inicio: "2026-01-01", fim: "2026-12-31" } : index === 6 ? result : initial, () => {}];
    } },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "../utils/format": format,
  });
  const tree = ClientPeriodSearch({ user: { role: "SuperAdmin" }, vinculos: [], insuranceTypes: [], onView: async () => {} });
  const cells = [];
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if (node.type === "td") cells.push(node.props.children);
    walk(node.props?.children);
  }
  walk(tree);
  assert.ok(cells.includes("SOP7I82"));
  assert.ok(cells.includes("123.456.789-00"));
});
