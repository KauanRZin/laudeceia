const prisma = require("../../database/client");
const AppError = require("../../utils/AppError");
const {
  TIPO_DOCUMENTO,
  INSURANCE_TYPE_NOME_POR_TIPO_DOCUMENTO,
  VINCULO_SEM_AGENCIA,
  VINCULO_PADRAO,
  AGENCIAS,
  vinculoNomePorAgencia,
  DADOS_GENERICO,
} = require("../../config/import");

// ---------------------------------------------------------------------------
// Helpers de texto / data
// ---------------------------------------------------------------------------

function removerAcentos(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function vazio(valor) {
  return valor === null || valor === undefined || String(valor).trim() === "";
}

// Chave normalizada para comparar nomes: minúsculo, sem acento, espaços colapsados.
function chaveNome(nome) {
  return removerAcentos(nome).toLowerCase().trim().replace(/\s+/g, " ");
}

function somenteDigitos(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

// Formata 11 dígitos em "000.000.000-00"
function formatarCpf(digitos) {
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
}

// Converte "dd/mm/yyyy" ou "dd/mm/yy" em Date. Retorna null se não conseguir.
function parseDataBr(valor) {
  if (vazio(valor)) return null;

  const match = String(valor).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;

  let [, dia, mes, ano] = match;
  dia = Number(dia);
  mes = Number(mes);
  ano = Number(ano);
  if (ano < 100) ano += 2000;

  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return Number.isNaN(data.getTime()) ? null : data;
}

function subtrairAnos(data, anos) {
  const nova = new Date(data.getTime());
  nova.setUTCFullYear(nova.getUTCFullYear() - anos);
  return nova;
}

// Gera um CPF "genérico" identificável, único o suficiente para não colidir
// com a constraint unique do banco quando um cliente é criado sem CPF real
// (RE/AUTO). NÃO é um CPF válido de verdade — é só um placeholder.
function gerarCpfGenerico() {
  const sufixo = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8);
  return `${DADOS_GENERICO.cpf}${sufixo}`;
}

// ---------------------------------------------------------------------------
// Identificação do tipo de documento (centralizada e fácil de ajustar caso
// novos formatos de planilha/rótulos apareçam)
// ---------------------------------------------------------------------------

function identificarTipoDocumento(tipoBruto) {
  const texto = chaveNome(tipoBruto);

  if (texto.includes("vida")) return TIPO_DOCUMENTO.VIDA;
  if (texto.includes("auto")) return TIPO_DOCUMENTO.AUTO;
  if (/\bre\b/.test(texto)) return TIPO_DOCUMENTO.RE;

  throw new AppError(`Tipo de documento não reconhecido: "${tipoBruto}"`, 400, "UNKNOWN_DOCUMENT_TYPE");
}

// ---------------------------------------------------------------------------
// Agência / vínculo
// ---------------------------------------------------------------------------

function determinarVinculo(tipoDocumento, agenciaBruta) {
  if (tipoDocumento === TIPO_DOCUMENTO.VIDA) {
    return {
      vinculoNome: VINCULO_SEM_AGENCIA,
      alteracao: "VIDA sem agência; revisar vínculo.",
    };
  }

  const numero = vazio(agenciaBruta) ? null : String(agenciaBruta).trim();
  const nomeAgencia = numero ? AGENCIAS[numero] : undefined;

  if (nomeAgencia) {
    return { vinculoNome: vinculoNomePorAgencia(nomeAgencia), alteracao: null };
  }

  return {
    vinculoNome: VINCULO_PADRAO,
    alteracao: "Agência não identificada; vínculo padrão usado.",
  };
}

// ---------------------------------------------------------------------------
// Busca de cliente já existente
// ---------------------------------------------------------------------------

function chaveIdentificacao(tipoDocumento, segurado) {
  if (tipoDocumento === TIPO_DOCUMENTO.VIDA) {
    const cpf = somenteDigitos(segurado.cpf);
    return cpf ? `cpf:${cpf}` : null;
  }
  const nome = vazio(segurado.segurado) ? null : chaveNome(segurado.segurado);
  return nome ? `nome:${nome}` : null;
}

async function buscarClienteExistente(db, tipoDocumento, segurado) {
  if (tipoDocumento === TIPO_DOCUMENTO.VIDA) {
    const cpf = somenteDigitos(segurado.cpf);
    if (!cpf) return null;
    return db.client.findUnique({ where: { cpf }, include: { vinculos: true } });
  }

  const nomeBruto = segurado.segurado;
  if (vazio(nomeBruto)) return null;

  // Pré-filtro "contains" (case-insensitive) pra não varrer a tabela toda,
  // e depois comparação exata normalizada (sem acento) em memória.
  const candidatos = await db.client.findMany({
    where: { nome: { contains: String(nomeBruto).trim(), mode: "insensitive" } },
    include: { vinculos: true },
  });

  const chave = chaveNome(nomeBruto);
  return candidatos.find(cliente => chaveNome(cliente.nome) === chave) || null;
}

// ---------------------------------------------------------------------------
// Montagem dos dados do cliente
// ---------------------------------------------------------------------------

function montarDadosNovoCliente(segurado) {
  const alteracoes = [];

  const nome = vazio(segurado.segurado) ? null : String(segurado.segurado).trim();
  if (!nome) {
    throw new AppError("Nome do segurado ausente na planilha.", 400, "MISSING_NAME");
  }

  let cpf = somenteDigitos(segurado.cpf);
  if (!cpf) {
    cpf = gerarCpfGenerico();
    alteracoes.push("CPF genérico utilizado.");
  } else if (cpf.length !== 11) {
    throw new AppError(`CPF inválido: "${segurado.cpf}"`, 400, "INVALID_CPF");
  }
  cpf = formatarCpf(cpf);

  alteracoes.push("Telefone genérico utilizado.");
  alteracoes.push("Nascimento genérico utilizado.");
  alteracoes.push("Endereço genérico utilizado.");

  return {
    dados: {
      nome,
      cpf,
      telefone: DADOS_GENERICO.telefone,
      nascimento: new Date(DADOS_GENERICO.nascimento),
      endereco: {
        logradouro: DADOS_GENERICO.endereco,
        numero: DADOS_GENERICO.numero,
        bairro: DADOS_GENERICO.bairro,
        cidade: DADOS_GENERICO.cidade,
      },
    },
    alteracoes,
  };
}

// Para cliente já existente: só atualiza o que realmente veio de novo na
// planilha (nunca sobrescreve com genérico, nunca apaga com vazio).
function montarAtualizacaoCliente(segurado, clienteAtual, tipoDocumento) {
  const dados = {};

  // AUTO/RE não trazem CPF na planilha -> nunca mexe no CPF existente.
  // VIDA identifica pelo próprio CPF, então o nome pode ser corrigido se vier diferente.
  if (tipoDocumento === TIPO_DOCUMENTO.VIDA) {
    const novoNome = vazio(segurado.segurado) ? null : String(segurado.segurado).trim();
    if (novoNome && chaveNome(novoNome) !== chaveNome(clienteAtual.nome)) {
      dados.nome = novoNome;
    }
  }

  return dados;
}

// ---------------------------------------------------------------------------
// Vigência do seguro
// ---------------------------------------------------------------------------

function calcularVigencia(tipoDocumento, fimVigBruto) {
  const dataBase = parseDataBr(fimVigBruto);
  if (!dataBase) {
    throw new AppError(`Data de fim de vigência ausente ou inválida: "${fimVigBruto}"`, 400, "INVALID_FIM_VIGENCIA");
  }

  if (tipoDocumento === TIPO_DOCUMENTO.VIDA) {
    // VIDA não tem fim de vigência: a data da planilha (renovação) vira o início do período atual.
    return { inicioVigencia: dataBase, fimVigencia: null };
  }

  // AUTO/RE: início = 1 ano antes do fim informado.
  return { inicioVigencia: subtrairAnos(dataBase, 1), fimVigencia: dataBase };
}

// ---------------------------------------------------------------------------
// Insurance: um registro por cliente + tipo (upsert)
// ---------------------------------------------------------------------------

async function upsertInsurance(db, { clientId, tipoId, vinculoId, inicioVigencia, fimVigencia }) {
  const existente = await db.insurance.findFirst({ where: { clientId, tipoId } });

  if (existente) {
    return db.insurance.update({
      where: { id: existente.id },
      data: { vinculoId, inicioVigencia, fimVigencia },
    });
  }

  return db.insurance.create({
    data: { clientId, tipoId, vinculoId, inicioVigencia, fimVigencia },
  });
}

// ---------------------------------------------------------------------------
// Vínculo do cliente (M2M): adiciona sem remover os que já existem,
// respeitando o limite de 2 vínculos por cliente usado no resto do sistema.
// ---------------------------------------------------------------------------

function avaliarVinculoDoCliente(clienteAtual, vinculo) {
  const vinculosAtuais = clienteAtual?.vinculos || [];
  const jaTem = vinculosAtuais.some(v => v.id === vinculo.id);
  if (jaTem) return { conectar: false, alteracao: null };

  if (vinculosAtuais.length >= 2) {
    return {
      conectar: false,
      alteracao: `Limite de vínculos atingido; "${vinculo.nome}" não adicionado.`,
    };
  }

  return { conectar: true, alteracao: null };
}

// ---------------------------------------------------------------------------
// Observação consolidada
// ---------------------------------------------------------------------------

function montarObservacao(alteracoes, observacaoAnterior) {
  if (!alteracoes.length) return observacaoAnterior;

  const texto = `Importação: ${alteracoes.join(" ")}`;

  return observacaoAnterior ? `${observacaoAnterior} | ${texto}` : texto;
}

// ---------------------------------------------------------------------------
// Processamento de uma linha (um segurado), em transação
// ---------------------------------------------------------------------------

async function processarSegurado({ tipoDocumento, insuranceTypeId, segurado, processadosNaImportacao }) {
  const chave = chaveIdentificacao(tipoDocumento, segurado);
  if (!chave) {
    throw new AppError(
      tipoDocumento === TIPO_DOCUMENTO.VIDA ? "CPF ausente na planilha." : "Nome do segurado ausente na planilha.",
      400,
      "MISSING_KEY"
    );
  }

  const { vinculoNome, alteracao: alteracaoVinculo } = determinarVinculo(tipoDocumento, segurado.agencia);
  const { inicioVigencia, fimVigencia } = calcularVigencia(tipoDocumento, segurado.fim_vig);

  return prisma.$transaction(async tx => {
    const vinculo = await tx.vinculo.findUnique({ where: { nome: vinculoNome } });
    if (!vinculo) {
      throw new AppError(`Vínculo "${vinculoNome}" não está cadastrado.`, 500, "VINCULO_NOT_FOUND");
    }

    // Já processado nesta mesma importação (duas linhas = mesma pessoa)?
    const clientIdJaProcessado = processadosNaImportacao.get(chave);

    if (clientIdJaProcessado) {
      const clienteAtual = await tx.client.findUnique({
        where: { id: clientIdJaProcessado },
        include: { vinculos: true },
      });
      const { conectar } = avaliarVinculoDoCliente(clienteAtual, vinculo);

      if (conectar) {
        await tx.client.update({
          where: { id: clientIdJaProcessado },
          data: { vinculos: { connect: { id: vinculo.id } } },
        });
      }

      await upsertInsurance(tx, { clientId: clientIdJaProcessado, tipoId: insuranceTypeId, vinculoId: vinculo.id, inicioVigencia, fimVigencia });

      return { status: "atualizado", clientId: clientIdJaProcessado, comDadosGenericos: false };
    }

    const clienteExistente = await buscarClienteExistente(tx, tipoDocumento, segurado);

    if (clienteExistente) {
      const dados = montarAtualizacaoCliente(segurado, clienteExistente, tipoDocumento);
      const { conectar, alteracao: alteracaoVinculoCliente } = avaliarVinculoDoCliente(clienteExistente, vinculo);

      const alteracoes = [alteracaoVinculoCliente, alteracaoVinculo].filter(Boolean);
      const houveAlteracaoDados = Object.keys(dados).length > 0;

      if (houveAlteracaoDados || conectar || alteracoes.length) {
        await tx.client.update({
          where: { id: clienteExistente.id },
          data: {
            ...dados,
            ...(conectar && { vinculos: { connect: { id: vinculo.id } } }),
            ...(alteracoes.length && { observacao: montarObservacao(alteracoes, clienteExistente.observacao) }),
          },
        });
      }

      await upsertInsurance(tx, {
        clientId: clienteExistente.id,
        tipoId: insuranceTypeId,
        vinculoId: vinculo.id,
        inicioVigencia,
        fimVigencia,
      });

      processadosNaImportacao.set(chave, clienteExistente.id);

      return {
        status: houveAlteracaoDados || conectar || alteracoes.length ? "atualizado" : "sem_alteracao",
        clientId: clienteExistente.id,
        comDadosGenericos: false,
      };
    }

    // Cliente novo
    const { dados, alteracoes } = montarDadosNovoCliente(segurado);
    if (alteracaoVinculo) alteracoes.push(alteracaoVinculo);

    let novoCliente;
    try {
      novoCliente = await tx.client.create({
        data: { ...dados, observacao: montarObservacao(alteracoes, "") || "", vinculos: { connect: { id: vinculo.id } } },
      });
    } catch (error) {
      if (error.code === "P2002") {
        throw new AppError("Conflito ao criar cliente (CPF já cadastrado).", 409, "CPF_ALREADY_EXISTS");
      }
      throw error;
    }

    await upsertInsurance(tx, {
      clientId: novoCliente.id,
      tipoId: insuranceTypeId,
      vinculoId: vinculo.id,
      inicioVigencia,
      fimVigencia,
    });

    processadosNaImportacao.set(chave, novoCliente.id);

    return { status: "criado", clientId: novoCliente.id, comDadosGenericos: alteracoes.length > 0 };
  });
}

// ---------------------------------------------------------------------------
// Rota principal: recebe o documento já normalizado pelo importador do front
// ({ documento: { tipo }, segurados: [{ segurado, fim_vig, cpf, agencia }] })
// ---------------------------------------------------------------------------

async function importSpreadsheet(user, body) {
  const documento = body?.documento;
  const segurados = Array.isArray(body?.segurados) ? body.segurados : [];

  if (!documento?.tipo) {
    throw new AppError("Documento sem tipo informado.", 400, "MISSING_DOCUMENT_TYPE");
  }

  const tipoDocumento = identificarTipoDocumento(documento.tipo);
  const insuranceTypeNome = INSURANCE_TYPE_NOME_POR_TIPO_DOCUMENTO[tipoDocumento];

  const insuranceType = await prisma.insuranceType.findUnique({ where: { nome: insuranceTypeNome } });
  if (!insuranceType) {
    throw new AppError(`Tipo de seguro "${insuranceTypeNome}" não está cadastrado.`, 500, "INSURANCE_TYPE_NOT_FOUND");
  }

  const resumo = {
    tipoDocumento,
    processados: 0,
    criados: 0,
    atualizados: 0,
    semAlteracao: 0,
    comDadosGenericos: 0,
    erros: [],
  };

  const processadosNaImportacao = new Map();

  for (let i = 0; i < segurados.length; i += 1) {
    const segurado = segurados[i];
    resumo.processados += 1;

    try {
      const resultado = await processarSegurado({
        tipoDocumento,
        insuranceTypeId: insuranceType.id,
        segurado,
        processadosNaImportacao,
      });

      if (resultado.status === "criado") resumo.criados += 1;
      else if (resultado.status === "atualizado") resumo.atualizados += 1;
      else resumo.semAlteracao += 1;

      if (resultado.comDadosGenericos) resumo.comDadosGenericos += 1;
    } catch (error) {
      resumo.erros.push({
        linha: i + 1,
        nome: segurado?.segurado || segurado?.cpf || "desconhecido",
        erro: error instanceof AppError ? error.message : "Erro inesperado ao processar registro.",
      });
    }
  }

  return resumo;
}

module.exports = { importSpreadsheet };