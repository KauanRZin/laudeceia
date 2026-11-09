import { useRef, useState } from 'react';
import * as xlsx from 'xlsx';
import { Upload, Loader2 } from 'lucide-react';

export interface SeguradoImportado {
  segurado: string | null;
  fim_vig: string | null;
  cpf: string | null;
  agencia: string | null;
  placa?: string | null;
  modelo?: string | null;
}

export interface DocumentoImportado {
  tipo: string;
  filtros?: Record<string, string>;
}

export interface ImportacaoPlanilha {
  documento: DocumentoImportado;
  segurados: SeguradoImportado[];
}

interface ImportadorProps {
  onImport: (
    importacao: ImportacaoPlanilha,
    vinculoPadrao: string
  ) => void | Promise<void>;
  vinculoPadrao: string;
}

// ---------------------------------------------------------------------------
// Helpers de texto
// ---------------------------------------------------------------------------

function normalizarTexto(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function removerAcentos(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function valorVazio(valor: unknown): boolean {
  return valor === null || valor === undefined || String(valor).trim() === '';
}

function linhaVazia(row: unknown[]): boolean {
  return row.every(valorVazio);
}

function linhaTemTexto(row: unknown[], textos: string[]): boolean {
  return textos.every(texto =>
    row.some(cell => !valorVazio(cell) && removerAcentos(cell).includes(removerAcentos(texto)))
  );
}

// ---------------------------------------------------------------------------
// Detecção de estrutura da planilha
// ---------------------------------------------------------------------------

function encontrarCabecalho(rows: unknown[][]): number {
  return rows.findIndex(row => linhaTemTexto(row, ['segurado', 'apolice']));
}

// Detecta a linha de rótulos da VIDA (ex: "Cliente", "CPF do cliente", "Data da renovacao")
// que não é pega pelo encontrarCabecalho (não tem "segurado"/"apólice")
function ehLinhaRotuloVida(row: unknown[]): boolean {
  return linhaTemTexto(row, ['cliente', 'cpf']);
}

// Verifica se alguma linha ANTES do cabeçalho indica que é um arquivo de RE
// (planilhas de RE trazem linhas de título como "SEGURADORA" / "Apólices a renovar")
function ehRE(rowsAntesDoHeader: unknown[][]): boolean {
  return rowsAntesDoHeader.some(row =>
    row.some(cell => {
      if (valorVazio(cell)) return false;
      const texto = normalizarTexto(cell);
      return texto.includes('apolices_a_renovar') || texto === 'seguradora';
    })
  );
}

// Dado o cabeçalho (nome normalizado por coluna), encontra o índice da coluna
// que corresponde a segurado/cliente, data (vigência/renovação), cpf e agência.
// Usa prioridade em vez de "primeiro que bater", para não confundir, por exemplo,
// "Valor da Renovação" (monetário) com "Fim da vigência" (data).
function localizarColunas(headers: Record<number, string>, colunasSemRotulo: Record<string, number>) {
  const entradas = Object.entries(headers).map(([coluna, nome]) => ({
    coluna: Number(coluna),
    nome
  }));

  function melhorMatch(prioridades: string[], excluir: string[] = []): number {
    for (const chave of prioridades) {
      const encontrada = entradas.find(
        ({ nome }) => nome.includes(chave) && !excluir.some(ex => nome.includes(ex))
      );
      if (encontrada) return encontrada.coluna;
    }
    return -1;
  }

  const colSegurado = melhorMatch(['segurado', 'cliente']);
  const colFimVig = melhorMatch(
    ['fim_da_vigencia', 'fim_vigencia', 'vigencia', 'fim_vig', 'vencimento', 'renovacao'],
    ['valor'] // nunca considerar colunas monetárias (ex: "Valor da Renovação")
  );
  const colCpf = melhorMatch(['cpf']);
  const colAgencia = melhorMatch(['agencia']);
  // TODO: Alterar os nomes das colunas de placa e veículo aqui se o cabeçalho mudar.
  const nomeColunaPlaca = normalizarTexto('Placa');
  const nomeColunaModelo = normalizarTexto('Veículo');
  const colPlaca = entradas.find(({ nome }) => nome === nomeColunaPlaca)?.coluna
    ?? colunasSemRotulo['__EMPTY_42'] ?? -1;
  const colModelo = entradas.find(({ nome }) => nome === nomeColunaModelo)?.coluna
    ?? entradas.find(({ nome }) => nome === 'modelo' || nome === 'modelo_do_veiculo')?.coluna
    ?? colunasSemRotulo['__EMPTY_33'] ?? -1;
  return { colSegurado, colFimVig, colCpf, colAgencia, colPlaca, colModelo };
}

function mapearColunasSemRotulo(rows: unknown[][]): Record<string, number> {
  if (!rows.length) return {};
  // Reproduz os nomes __EMPTY do sheet_to_json padrão a partir da primeira linha.
  // A segunda linha sintética guarda os índices; não altera os dados da planilha.
  const largura = rows.reduce((maior, row) => Math.max(maior, row.length), 0);
  const mapa = xlsx.utils.aoa_to_sheet([rows[0], Array.from({ length: largura }, (_, indice) => indice)]);
  return xlsx.utils.sheet_to_json<Record<string, number>>(mapa)[0] ?? {};
}

function colunasDoCabecalho(aba: xlsx.WorkSheet, linha: number, coluna: number): number[] {
  if (coluna === -1) return [];

  const inicio = xlsx.utils.decode_range(aba['!ref'] ?? 'A1').s;
  const mescla = aba['!merges']?.find(({ s, e }) =>
    s.r === inicio.r + linha && s.c === inicio.c + coluna && e.c > s.c
  );
  const largura = mescla ? mescla.e.c - mescla.s.c + 1 : 1;
  return Array.from({ length: largura }, (_, deslocamento) => coluna + deslocamento);
}

function lerDadoVeiculo(row: unknown[], colunas: number[]): string | null {
  const coluna = colunas.find(indice => !valorVazio(row[indice]));
  return coluna === undefined ? null : String(row[coluna]).trim();
}

// Colunas fixas para VIDA (sem cabeçalho), na ordem em que aparecem
const COLUNAS_VIDA = [
  'apolice',
  'cliente',
  'cpf',
  'produto',
  'frequencia_de_pagamento',
  'data_da_renovacao',
  'status'
];

const IDX_VIDA = {
  segurado: COLUNAS_VIDA.indexOf('cliente'),
  fim_vig: COLUNAS_VIDA.indexOf('data_da_renovacao'),
  cpf: COLUNAS_VIDA.indexOf('cpf')
};

// ---------------------------------------------------------------------------
// Processamento principal
// ---------------------------------------------------------------------------

function processarPlanilha(rows: unknown[][], aba: xlsx.WorkSheet): ImportacaoPlanilha {
  const headerIndex = encontrarCabecalho(rows);

  const segurados: SeguradoImportado[] = [];
  let tipo: string;

  if (headerIndex === -1) {
    // Sem cabeçalho -> VIDA (colunas fixas por posição, cpf real)
    tipo = 'Seguro de Vida';

    for (const row of rows) {
      if (linhaVazia(row)) continue;
      if (ehLinhaRotuloVida(row)) continue; // pula linha de rótulos tipo "Cliente"/"CPF do cliente"

      segurados.push({
        segurado: valorVazio(row[IDX_VIDA.segurado]) ? null : String(row[IDX_VIDA.segurado]).trim(),
        fim_vig: valorVazio(row[IDX_VIDA.fim_vig]) ? null : String(row[IDX_VIDA.fim_vig]).trim(),
        cpf: valorVazio(row[IDX_VIDA.cpf]) ? null : String(row[IDX_VIDA.cpf]).trim(),
        agencia: null
      });
    }
  } else {
    // Com cabeçalho -> AUTO ou RE (nunca tem cpf, sempre null)
    const rowsAntesDoHeader = rows.slice(0, headerIndex);
    tipo = ehRE(rowsAntesDoHeader) ? 'Seguro de RE' : 'Seguro de Auto';

    const headerRow = rows[headerIndex];
    const headers: Record<number, string> = {};

    headerRow.forEach((valor, coluna) => {
      if (!valorVazio(valor)) {
        headers[coluna] = normalizarTexto(valor);
      }
    });

    const { colSegurado, colFimVig, colAgencia, colPlaca, colModelo } = localizarColunas(headers, mapearColunasSemRotulo(rows));
    const colunasPlaca = colunasDoCabecalho(aba, headerIndex, colPlaca);
    const colunasModelo = colunasDoCabecalho(aba, headerIndex, colModelo);

    // Neste layout de Auto, os rótulos ficam em AJ/AO, mas os dados em AH/AQ.
    const inicioColuna = xlsx.utils.decode_range(aba['!ref'] ?? 'A1').s.c;
    const indiceColuna = (letra: string) => xlsx.utils.decode_col(letra) - inicioColuna;
    const colunaDadosModelo = indiceColuna('AH');
    const colunaDadosPlaca = indiceColuna('AQ');
    if (tipo === 'Seguro de Auto'
      && colModelo === indiceColuna('AJ') && headers[colModelo] === 'veiculo'
      && colPlaca === indiceColuna('AO') && headers[colPlaca] === 'placa') {
      if (colunaDadosModelo >= 0 && !headers[colunaDadosModelo] && !colunasModelo.includes(colunaDadosModelo)) {
        colunasModelo.push(colunaDadosModelo);
      }
      if (!headers[colunaDadosPlaca] && !colunasPlaca.includes(colunaDadosPlaca)) {
        colunasPlaca.push(colunaDadosPlaca);
      }
    }

    if (colSegurado === -1) {
      throw new Error('Não foi possível localizar a coluna de segurado na planilha.');
    }

    const dataRows = rows.slice(headerIndex + 1);

    let agenciaMemoria: string | null = null;

    for (const row of dataRows) {
      if (linhaVazia(row)) continue;

      // O cabeçalho "Agência" costuma ser uma célula mesclada: o texto aparece
      // na coluna X, mas o valor de dado real cai na coluna seguinte (X+1).
      if (colAgencia !== -1) {
        const bruto = !valorVazio(row[colAgencia]) ? row[colAgencia] : row[colAgencia + 1];
        if (!valorVazio(bruto)) {
          agenciaMemoria = String(bruto).trim();
        }
      }

      segurados.push({
        segurado: valorVazio(row[colSegurado]) ? null : String(row[colSegurado]).trim(),
        fim_vig: colFimVig === -1 || valorVazio(row[colFimVig]) ? null : String(row[colFimVig]).trim(),
        agencia: agenciaMemoria,
        ...(tipo === 'Seguro de Auto' && {
          placa: lerDadoVeiculo(row, colunasPlaca),
          modelo: lerDadoVeiculo(row, colunasModelo)
        }),
        cpf: null
      });
    }
  }

  return {
    documento: { tipo },
    segurados
  };
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ImportadorPlanilha({ onImport, vinculoPadrao }: ImportadorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);

  const processarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setCarregando(true);

    const leitor = new FileReader();

    leitor.onload = async evento => {
      try {
        const buffer = evento.target?.result;

        if (!buffer) {
          throw new Error('Não foi possível ler o arquivo.');
        }

        const workbook = xlsx.read(buffer, { type: 'array' });

        const nomeAba = workbook.SheetNames[0];

        if (!nomeAba) {
          throw new Error('A planilha não possui nenhuma aba.');
        }

        const aba = workbook.Sheets[nomeAba];

        const rows = xlsx.utils.sheet_to_json<unknown[]>(aba, {
          header: 1,
          defval: null,
          raw: false
        });

        const importacao = processarPlanilha(rows, aba);
        await onImport(importacao, vinculoPadrao);
      } catch (error) {
        console.error('Erro ao ler planilha:', error);

      } finally {
        setCarregando(false);

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    leitor.readAsArrayBuffer(file);
  };

  return (
    <>
      <input
        type="file"
        accept=".xlsx,.xls"
        ref={fileInputRef}
        onChange={processarArquivo}
        className="hidden"
      />

      <button
        className="btn-outline flex items-center gap-2 disabled:opacity-50"
        onClick={() => fileInputRef.current?.click()}
        disabled={carregando}
      >
        {carregando ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}

        {carregando ? 'Lendo...' : 'Importar Dados'}
      </button>
    </>
  );
}
