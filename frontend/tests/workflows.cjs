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
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => dependencies[name] || {} });
  return exports;
}

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
