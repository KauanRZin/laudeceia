import { useRef, useState } from 'react';
import * as xlsx from 'xlsx';
import { Upload, Loader2 } from 'lucide-react';

export interface SeguradoImportado {
  [campo: string]: string;
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
  ) => void;
  vinculoPadrao: string;
}

function normalizarTexto(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function linhaContem(row: unknown[], texto: string): boolean {
  return row.some(cell =>
    String(cell ?? '')
      .toLowerCase()
      .includes(texto.toLowerCase())
  );
}

function encontrarCabecalho(rows: unknown[][]): number {
  return rows.findIndex(row =>
    linhaContem(row, 'segurado') &&
    linhaContem(row, 'apólice')
  );
}

function detectarTipoDocumento(rows: unknown[][]): string {
  const texto = rows
    .flat()
    .filter(Boolean)
    .map(value => String(value).toLowerCase())
    .join(' ');

  if (
    texto.includes('veiculo') ||
    texto.includes('veículo') ||
    texto.includes('placa')
  ) {
    return 'veiculo';
  }

  if (
    texto.includes('residencial') ||
    texto.includes('residencia') ||
    texto.includes('residência')
  ) {
    return 'residencial';
  }

  if (texto.includes('vida')) {
    return 'vida';
  }

  return 'desconhecido';
}

export function ImportadorPlanilha({
  onImport,
  vinculoPadrao
}: ImportadorProps) {

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);

  const processarArquivo = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    const file = e.target.files?.[0];

    if (!file) return;

    setCarregando(true);

    const leitor = new FileReader();

    leitor.onload = (evento) => {

      try {

        const buffer = evento.target?.result;

        if (!buffer) {
          throw new Error('Não foi possível ler o arquivo.');
        }

        const workbook = xlsx.read(buffer, {
          type: 'array'
        });

        const nomeAba = workbook.SheetNames[0];

        if (!nomeAba) {
          throw new Error('A planilha não possui nenhuma aba.');
        }

        const aba = workbook.Sheets[nomeAba];

        const rows = xlsx.utils.sheet_to_json<unknown[]>(
          aba,
          {
            header: 1,
            defval: null,
            raw: false
          }
        );

        const headerIndex = encontrarCabecalho(rows);

        if (headerIndex === -1) {
          throw new Error(
            'Não foi possível identificar o cabeçalho da planilha.'
          );
        }

        const headerRow = rows[headerIndex];

        const headers: Record<number, string> = {};

        headerRow.forEach((valor, coluna) => {

          if (
            valor !== null &&
            valor !== undefined &&
            String(valor).trim() !== ''
          ) {
            headers[coluna] = normalizarTexto(valor);
          }

        });

        const dataRows = rows.slice(headerIndex + 1);

        const segurados: SeguradoImportado[] = [];

        for (const row of dataRows) {

          const segurado: SeguradoImportado = {};

          row.forEach((valor, coluna) => {

            if (
              valor === null ||
              valor === undefined ||
              String(valor).trim() === ''
            ) {
              return;
            }

            const campo = headers[coluna];

            if (!campo) {
              return;
            }

            segurado[campo] = String(valor).trim();

          });

          if (Object.keys(segurado).length > 0) {
            segurados.push(segurado);
          }
        }

        const importacao: ImportacaoPlanilha = {
          documento: {
            tipo: detectarTipoDocumento(rows)
          },
          segurados
        };

        console.log(
          'JSON da importação:',
          importacao
        );

        onImport(
          importacao,
          vinculoPadrao
        );

      } catch (error) {

        console.error(
          'Erro ao ler planilha:',
          error
        );

        alert(
          error instanceof Error
            ? error.message
            : 'Erro ao processar a planilha.'
        );

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
        {carregando ? (
          <Loader2
            size={16}
            className="animate-spin"
          />
        ) : (
          <Upload size={16} />
        )}

        {carregando
          ? 'Lendo...'
          : 'Importar Dados'}
      </button>
    </>
  );
}