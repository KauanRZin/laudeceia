// Configuração centralizada para a importação de planilhas de clientes.
// Edite estes valores para ajustar o comportamento sem tocar na lógica do serviço.

// Tipos de documento suportados hoje. Se um novo formato de planilha aparecer,
// adicione uma chave aqui e ensine `identificarTipoDocumento` (em
// clients.import.service.js) a reconhecer o novo formato.
const TIPO_DOCUMENTO = Object.freeze({
  AUTO: "AUTO",
  VIDA: "VIDA",
  RE: "RE",
});

// Nome do InsuranceType (tabela InsuranceType, campo `nome`) correspondente a
// cada tipo de documento. Precisa bater exatamente com o valor da seed.
const INSURANCE_TYPE_NOME_POR_TIPO_DOCUMENTO = {
  [TIPO_DOCUMENTO.AUTO]: "Seguro Auto",
  [TIPO_DOCUMENTO.VIDA]: "Seguro Vida",
  [TIPO_DOCUMENTO.RE]: "Seguro RE",
};

// Vínculo usado quando o documento é de VIDA (não tem número de agência).
const VINCULO_SEM_AGENCIA = "Agência";

// Vínculo "base", sem agência específica — usado como fallback quando o
// número de agência do documento não corresponde a nenhuma configurada abaixo.
const VINCULO_PADRAO = "LAUDYS Corretora";

// Mapa "número da agência no documento" -> "nome da agência".
// Edite/adicione entradas aqui conforme novas agências surgirem.
const AGENCIAS = {
  "1784": "Limoeiro",
  "835": "Surubim",
};

// Monta o nome do Vinculo (tabela Vinculo, campo `nome`) a partir do nome da agência.
// Precisa bater com os valores cadastrados em Vinculo (ex: "LAUDYS Corretora Agencia Limoeiro").
function vinculoNomePorAgencia(nomeAgencia) {
  return `${VINCULO_PADRAO} Agencia ${nomeAgencia}`;
}

// Dados genéricos usados quando o documento não traz informação suficiente
// para preencher um campo obrigatório do cliente.
const DADOS_GENERICO = {
  // Usado como prefixo para gerar um CPF placeholder único por cliente novo
  // (o CPF é único no banco, então não dá pra usar sempre o mesmo valor fixo).
  cpf: "000",
  telefone: "(00) 00000-0000",
  nascimento: "1900-01-01",
  endereco: "Endereço não informado",
  numero: "S/N",
  bairro: "Não informado",
  cidade: "Não informado",
};

module.exports = {
  TIPO_DOCUMENTO,
  INSURANCE_TYPE_NOME_POR_TIPO_DOCUMENTO,
  VINCULO_SEM_AGENCIA,
  VINCULO_PADRAO,
  AGENCIAS,
  vinculoNomePorAgencia,
  DADOS_GENERICO,
};