const { test } = require("node:test");
const assert = require("node:assert/strict");
const { decodeValue, parseBackup } = require("../src/modules/users/database-restore");

test("decodifica os escapes do pg_dump sem confundir texto literal, campo vazio e nulo", () => {
  assert.equal(decodeValue(String.raw`\N`), null);
  assert.equal(decodeValue(String.raw`\\N`), String.raw`\N`);
  assert.equal(decodeValue(String.raw`\\.`), String.raw`\.`);
  assert.equal(decodeValue(String.raw`A\tB\nC\rD\b\f\v\\`), "A\tB\nC\rD\b\f\v\\");
  assert.equal(decodeValue(""), "");
  assert.throws(() => decodeValue(String.raw`\q`), { code: "INVALID_SQL_BACKUP" });
});

test("rejeita arquivos incompletos, com tabelas desconhecidas ou UTF-8 inválido", () => {
  const header = "--\n-- PostgreSQL database dump\n--\n";
  const footer = "--\n-- PostgreSQL database dump complete\n--\n";
  const block = "COPY public.\"Vinculo\" (id, nome) FROM stdin;\n1\tAgência\n\\.\n";
  for (const file of [
    Buffer.from(header + block),
    Buffer.from(header + block + footer),
    Buffer.from(header + block + block + footer),
    Buffer.from(header + block.replace("Vinculo", "Unknown") + footer),
    Buffer.concat([Buffer.from(header), Buffer.from([0xff]), Buffer.from(footer)]),
  ]) {
    assert.throws(() => parseBackup(file), { code: "INVALID_SQL_BACKUP" });
  }
});
