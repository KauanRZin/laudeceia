import { useRef, useState } from 'react';
import * as xlsx from 'xlsx';
import { Upload, Loader2 } from 'lucide-react';
import type { Client, Insurance } from '../types/domain';

interface ImportadorProps {
  onImport: (clientes: Client[]) => void;
  vinculoPadrao: string;
}

export function ImportadorPlanilha({ onImport, vinculoPadrao }: ImportadorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);

  const processarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCarregando(true);
    const leitor = new FileReader();

    leitor.onload = (evento) => {
      try {
        const buffer = evento.target?.result;
        const workbook = xlsx.read(buffer, { type: 'array' });
        const aba = workbook.Sheets[workbook.SheetNames[0]];
        
        // raw: false garante que datas do Excel venham como string formatada
        const linhas = xlsx.utils.sheet_to_json<any>(aba, { raw: false, defval: "" });

        // Agrupamento Inteligente: Por CPF (Vida) ou Por Nome (Carro)
        const clientesAgrupados = linhas.reduce((acc: Record<string, Client>, linha: any) => {
          const nomeStr = String(linha.Nome || '').trim();
          const cpfStr = String(linha.CPF || '').replace(/\D/g, '');
          
          // A chave única do dicionário. Se tem CPF usa ele, senão usa o Nome.
          const chaveUnica = cpfStr || nomeStr.toLowerCase();
          
          if (!chaveUnica) return acc; // Pula linhas totalmente vazias

          const novoSeguro: Insurance = {
            id: `tmp_${crypto.randomUUID()}`, 
            tipoId: 0, 
            tipoNome: linha.Tipo || linha['Tipo de Seguro'] || 'Automóvel', 
            inicioVigencia: '', 
            fimVigencia: linha.Data || linha.FimVigencia || null, 
            vinculoId: 0,
            vinculoNome: vinculoPadrao
          };

          if (acc[chaveUnica]) {
            // Cliente já existe no agrupamento, só adiciona o seguro
            acc[chaveUnica].seguros.push(novoSeguro);
          } else {
            // Cliente novo
            acc[chaveUnica] = {
              id: '', 
              nome: nomeStr,
              cpf: cpfStr,
              telefone: '',
              nascimento: '',
              observacao: 'Importado via planilha',
              endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' },
              vinculos: [vinculoPadrao],
              seguros: [novoSeguro] 
            };
          }

          return acc;
        }, {});

        const arrayClientes = Object.values(clientesAgrupados) as Client[];
        onImport(arrayClientes);
      } catch (error) {
        console.error("Erro ao ler planilha:", error);
        alert("Erro ao processar o arquivo. Verifique se é um Excel válido.");
      } finally {
        setCarregando(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    leitor.readAsArrayBuffer(file);
  };

  return (
    <>
      <input
        type="file"
        accept=".xlsx, .xls"
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