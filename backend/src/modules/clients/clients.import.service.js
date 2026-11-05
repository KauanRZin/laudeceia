const prisma = require("../../database/client");
const AppError = require("../../utils/AppError");
const { formatImportObservation } = require("../../utils/serializers");
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
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia ? data : null;
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
      alteracao: null,
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

async function buscarClientesPorNome(db, nome) {
  if (vazio(nome)) return [];
  const ids = await db.$queryRaw`
    SELECT "id" FROM "Client"
    WHERE btrim(regexp_replace(
      lower(regexp_replace(normalize("nome", NFD), ${"[\u0300-\u036f]"}, '', 'g')),
      '[[:space:]]+', ' ', 'g'
    )) = ${chaveNome(nome)}
  `;
  return db.client.findMany({ where: { id: { in: ids.map(cliente => cliente.id) } }, include: { vinculos: true } });
}

async function buscarClienteExistente(db, tipoDocumento, segurado) {
  if (tipoDocumento === TIPO_DOCUMENTO.VIDA) {
    const cpf = somenteDigitos(segurado.cpf);
    if (!cpf) return null;
    if (cpf.length !== 11) throw new AppError(`CPF inválido: "${segurado.cpf}"`, 400, "INVALID_CPF");
    const peloCpf = await db.client.findFirst({
      where: { cpf: { in: [cpf, formatarCpf(cpf)] } },
      include: { vinculos: true },
    });
    if (peloCpf) return peloCpf;

    const candidatos = await buscarClientesPorNome(db, segurado.segurado);
    const mesmoNome = candidatos.filter(cliente =>
      somenteDigitos(cliente.cpf).startsWith(DADOS_GENERICO.cpf)
      && cliente.observacao.includes("CPF genérico utilizado.")
    );
    if (mesmoNome.length > 1) {
      throw new AppError("Mais de um cliente com CPF genérico tem esse nome. Revise os cadastros antes de importar Vida.", 409, "AMBIGUOUS_CLIENT");
    }
    return mesmoNome[0] || null;
  }

  const candidatos = await buscarClientesPorNome(db, segurado.segurado);
  if (candidatos.length > 1) {
    throw new AppError("Mais de um cliente tem esse nome. Revise os cadastros antes de importar.", 409, "AMBIGUOUS_CLIENT");
  }
  return candidatos[0] || null;
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
    const cpf = somenteDigitos(segurado.cpf);
    if (somenteDigitos(clienteAtual.cpf) !== cpf) dados.cpf = formatarCpf(cpf);
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
// Insurance: mantém os três períodos mais recentes por cliente + tipo.
// ---------------------------------------------------------------------------

async function manterTresSegurosRecentes(db, clientId, tipoId) {
  await db.$queryRaw`SELECT "id" FROM "Client" WHERE "id" = ${clientId} FOR NO KEY UPDATE`;
  const seguros = await db.insurance.findMany({
    where: { clientId, tipoId },
    include: { tipo: true, vinculo: true },
  });
  // AUTO/RE usam o fim da vigência; VIDA usa a data de renovação (início).
  seguros.sort((a, b) =>
    new Date(b.fimVigencia ?? b.inicioVigencia) - new Date(a.fimVigencia ?? a.inicioVigencia)
    || new Date(b.createdAt) - new Date(a.createdAt)
    || a.id.localeCompare(b.id)
  );
  const excedentes = seguros.slice(3);
  if (excedentes.length) {
    await arquivarSegurosExcedentes(db, clientId, excedentes);
    await db.insurance.deleteMany({ where: { clientId, tipoId, id: { in: excedentes.map(seguro => seguro.id) } } });
  }
}

async function arquivarSegurosExcedentes(db, clientId, seguros) {
  const formatarData = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
  for (const seguro of seguros) {
    const inicio = formatarData.format(seguro.inicioVigencia);
    const periodo = seguro.fimVigencia
      ? `Vigência: ${inicio} a ${formatarData.format(seguro.fimVigencia)}`
      : `Renovação: ${inicio} — sem vencimento`;
    const historico = [
      `Seguro anterior — ${seguro.tipo.nome}`,
      periodo,
      `Vínculo: ${seguro.vinculo.nome}`,
    ].join("\n");

    await db.$executeRaw`
      UPDATE "Client"
      SET "observacao" = CASE WHEN "observacao" = '' THEN ${historico}
        ELSE "observacao" || E'\\n\\n' || ${historico} END,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${clientId} AND strpos("observacao", ${historico}) = 0
    `;
  }
}

async function upsertInsurance(db, { clientId, tipoId, vinculoId, inicioVigencia, fimVigencia }) {
  await db.$queryRaw`SELECT "id" FROM "Client" WHERE "id" = ${clientId} FOR NO KEY UPDATE`;
  // Reimportar o mesmo período atualiza seu vínculo, sem criar duplicata.
  const existente = await db.insurance.findFirst({
    where: { clientId, tipoId, inicioVigencia, fimVigencia },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

  if (existente) {
    await db.insurance.update({
      where: { id: existente.id },
      data: { vinculoId, inicioVigencia, fimVigencia },
    });
  } else {
    await db.insurance.create({
      data: { clientId, tipoId, vinculoId, inicioVigencia, fimVigencia },
    });
  }
  await manterTresSegurosRecentes(db, clientId, tipoId);
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
  const observacao = formatImportObservation(observacaoAnterior);
  const novas = [...new Set(alteracoes)].filter(item => !observacao.split("\n").includes(`- ${item}`));
  if (!novas.length) return observacao;
  const texto = `Importação\n${novas.map(item => `- ${item}`).join("\n")}`;
  return observacao ? `${observacao}\n\n${texto}` : texto;
}

function adicionarPlacaObservacao(tipoDocumento, placaBruta, observacaoAnterior = "", modeloBruto) {
  const observacao = formatImportObservation(observacaoAnterior);
  if (tipoDocumento !== TIPO_DOCUMENTO.AUTO) return observacao;
  const placa = String(placaBruta ?? "").trim().toUpperCase().replace(/[-\s]/g, "");
  const modelo = String(modeloBruto ?? "").trim().replace(/\s+/g, " ");
  if (!placa && !modelo) return observacao;
  const registro = ["Seguro Auto", modelo && `Modelo: ${modelo}`, placa && `Placa: ${placa}`].filter(Boolean).join("\n");
  if (observacao.split("\n\n").includes(registro)) return observacao;
  return observacao ? `${observacao}\n\n${registro}` : registro;
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
  // Valida antes de gravar qualquer dado da linha; placa ausente é opcional.
  adicionarPlacaObservacao(tipoDocumento, segurado.placa, "", segurado.modelo);

  return prisma.$transaction(async tx => {
    const vinculo = await tx.vinculo.findUnique({ where: { nome: vinculoNome } });
    if (!vinculo) {
      throw new AppError(`Vínculo "${vinculoNome}" não está cadastrado.`, 500, "VINCULO_NOT_FOUND");
    }

    const clientIdJaProcessado = processadosNaImportacao.get(chave);
    let clienteExistente = clientIdJaProcessado
      ? await tx.client.findUnique({
        where: { id: clientIdJaProcessado },
        include: { vinculos: true },
      })
      : await buscarClienteExistente(tx, tipoDocumento, segurado);

    if (clienteExistente) {
      await tx.$queryRaw`SELECT "id" FROM "Client" WHERE "id" = ${clienteExistente.id} FOR NO KEY UPDATE`;
      clienteExistente = await tx.client.findUnique({ where: { id: clienteExistente.id }, include: { vinculos: true } });
      if (tipoDocumento === TIPO_DOCUMENTO.VIDA
        && somenteDigitos(clienteExistente.cpf) !== somenteDigitos(segurado.cpf)
        && !clienteExistente.observacao.includes("CPF genérico utilizado.")) {
        throw new AppError("O CPF do cliente foi alterado por outra importação. Revise o cadastro.", 409, "CLIENT_CPF_CHANGED");
      }
      const dados = montarAtualizacaoCliente(segurado, clienteExistente, tipoDocumento);
      let observacao = adicionarPlacaObservacao(tipoDocumento, segurado.placa, clienteExistente.observacao, segurado.modelo);
      if (dados.cpf) {
        observacao = observacao.replace(/^- CPF genérico utilizado\.$/gm, "- CPF atualizado pela planilha de Vida.");
      }
      if (observacao !== clienteExistente.observacao) dados.observacao = observacao;
      const { conectar, alteracao: alteracaoVinculoCliente } = avaliarVinculoDoCliente(clienteExistente, vinculo);

      const alteracoes = [alteracaoVinculoCliente, alteracaoVinculo].filter(Boolean);
      const houveAlteracaoDados = Object.keys(dados).length > 0;

      if (houveAlteracaoDados || conectar || alteracoes.length) {
        await tx.client.update({
          where: { id: clienteExistente.id },
          data: {
            ...dados,
            ...(conectar && { vinculos: { connect: { id: vinculo.id } } }),
            ...(alteracoes.length && { observacao: montarObservacao(alteracoes, observacao) }),
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
        status: "atualizado",
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
        data: { ...dados, observacao: adicionarPlacaObservacao(tipoDocumento, segurado.placa, montarObservacao(alteracoes, "") || "", segurado.modelo), vinculos: { connect: { id: vinculo.id } } },
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

module.exports = { importSpreadsheet, adicionarPlacaObservacao, manterTresSegurosRecentes };
