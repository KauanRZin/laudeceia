import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { Download, Users, ShieldCheck, X, LoaderCircle } from "lucide-react";
import type { Client } from "../types/domain";
import type { InsuranceType } from "../api/insuranceTypesApi";
import { getClientsForExport, type ClientExportField, type ClientExportFilters, type ClientExportRow } from "../api/clientsApi";
import { normalizeApiError } from "../api/http";
import { formatDate } from "../utils/format";

// ---------------------------------------------------------------------------
// Exportação de clientes (.xlsx)
// ---------------------------------------------------------------------------

function formatEndereco(endereco?: Client["endereco"]) {
  if (!endereco) return "—";
  const partes = [endereco.logradouro, endereco.numero, endereco.complemento, endereco.bairro, endereco.cidade, endereco.estado].filter(Boolean);
  return partes.length ? partes.join(", ") : "—";
}

const camposExportacao: Record<ClientExportField, string> = {
  nascimento: "Data de nascimento",
  cpf: "CPF",
  telefone: "Telefone",
  endereco: "Endereço",
  observacao: "Observação",
};

function exportarClientes(lista: ClientExportRow[], filtros: ClientExportFilters) {
  const linhas = lista.map(({ cliente, seguro }) => {
    const valores: Record<ClientExportField, string> = {
      nascimento: formatDate(cliente.nascimento),
      cpf: cliente.cpf ?? "",
      telefone: cliente.telefone ?? "",
      endereco: formatEndereco(cliente.endereco),
      observacao: cliente.observacao ?? "",
    };
    return {
      Nome: cliente.nome,
      ...Object.fromEntries(filtros.campos.map(campo => [camposExportacao[campo], valores[campo]])),
      ...(filtros.modo === "seguros" && seguro && {
        "Tipo de seguro": seguro.tipoNome,
        Vínculo: seguro.vinculoNome,
        "Início de vigência": formatDate(seguro.inicioVigencia),
        "Fim de vigência": seguro.fimVigencia ? formatDate(seguro.fimVigencia) : "Sem vencimento",
      }),
    };
  });

  const planilha = XLSX.utils.json_to_sheet(linhas);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, "Clientes");

  const periodo = filtros.modo === "seguros" ? `_${filtros.inicio}_a_${filtros.fim}` : "";
  XLSX.writeFile(workbook, `clientes${periodo}.xlsx`);
}

export function ExportClientsModal({ vinculos, insuranceTypes, vinculoInicial, onClose }: {
  vinculos: string[];
  insuranceTypes: InsuranceType[];
  vinculoInicial: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [modo, setModo] = useState<ClientExportFilters["modo"]>("seguros");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [criterio, setCriterio] = useState<"vigencia" | "vencimento">("vigencia");
  const [tipoId, setTipoId] = useState("");
  const [vinculo, setVinculo] = useState(vinculoInicial);
  const [campos, setCampos] = useState<ClientExportField[]>(["nascimento", "cpf", "telefone", "endereco"]);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState("");
  const somenteClientes = modo === "clientes";

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  async function baixar() {
    if (exportando) return;
    setErro("");
    setExportando(true);
    try {
      const filtros: ClientExportFilters = {
        vinculo: vinculo || undefined,
        campos,
        ...(modo === "clientes" ? { modo } : {
          modo, inicio, fim, criterio, tipoId: tipoId ? Number(tipoId) : undefined,
        }),
      };
      const linhas = await getClientsForExport(filtros);
      if (linhas.length === 0) {
        setErro(somenteClientes ? "Nenhum cliente encontrado com esses filtros." : "Nenhum seguro encontrado com esses filtros.");
        return;
      }
      exportarClientes(linhas, filtros);
      onClose();
    } catch (error) {
      const apiError = normalizeApiError(error);
      setErro(Object.values(apiError.details ?? {})[0] || apiError.message);
    } finally {
      setExportando(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="titulo-exportacao-clientes"
      className="m-auto max-h-[90vh] w-11/12 max-w-xl overflow-y-auto rounded-2xl bg-white p-0 text-textPrimary shadow-2xl backdrop:bg-slate-950/60"
      onCancel={(event) => { event.preventDefault(); if (!exportando) onClose(); }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-blue-50 p-3 text-primary"><Download size={22} /></span>
          <div>
            <h2 id="titulo-exportacao-clientes" className="text-xl font-semibold">Exportar dados</h2>
            <p className="mt-1 text-sm text-textSecondary">Escolha o conteúdo da sua planilha.</p>
          </div>
        </div>
        <button type="button" aria-label="Fechar exportação" className="rounded-lg p-2 text-textSecondary hover:bg-slate-100 disabled:opacity-50" disabled={exportando} onClick={onClose}><X size={18} /></button>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void baixar(); }}>
        <fieldset disabled={exportando} className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-label="O que exportar">
            {([
              { value: "clientes", label: "Somente clientes", detail: "Uma linha por cliente", icon: Users },
              { value: "seguros", label: "Clientes e seguros", detail: "Uma linha por seguro", icon: ShieldCheck },
            ] as const).map(({ value, label, detail, icon: Icon }) => (
              <button key={value} type="button" aria-pressed={modo === value}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${modo === value ? "border-primary bg-blue-50 text-primary ring-1 ring-primary" : "border-slate-200 hover:bg-slate-50"}`}
                onClick={() => { setModo(value); setErro(""); }}>
                <Icon size={20} className="mt-0.5 shrink-0" />
                <span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-textSecondary">{detail}</span></span>
              </button>
            ))}
          </div>
          {!somenteClientes && <div className="space-y-4 rounded-xl bg-slate-50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className="label">Data inicial</span>
              <input className="input" type="date" required value={inicio} onChange={event => setInicio(event.target.value)} />
            </label>
            <label>
              <span className="label">Data final</span>
              <input className="input" type="date" required min={inicio || undefined} value={fim} onChange={event => setFim(event.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="label">Como usar o período</span>
            <select className="input" value={criterio} onChange={event => setCriterio(event.target.value as typeof criterio)}>
              <option value="vigencia">Seguros ativos no período</option>
              <option value="vencimento">Seguros com vencimento no período</option>
            </select>
          </label>
          </div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {!somenteClientes && <label>
              <span className="label">Tipo de seguro</span>
              <select className="input" value={tipoId} onChange={event => setTipoId(event.target.value)}>
                <option value="">Todos</option>
                {insuranceTypes.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}
              </select>
            </label>}
            <label>
              <span className="label">{somenteClientes ? "Vínculo do cliente" : "Vínculo do seguro"}</span>
              <select className="input" value={vinculo} onChange={event => setVinculo(event.target.value)}>
                <option value="">Todos</option>
                {vinculos.map(nome => <option key={nome} value={nome}>{nome}</option>)}
              </select>
            </label>
          </div>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">Dados do cliente</legend>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(camposExportacao) as ClientExportField[]).map(campo => (
                <label key={campo} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition ${campos.includes(campo) ? "border-blue-200 bg-blue-50/60" : "border-slate-200 hover:bg-slate-50"}`}>
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={campos.includes(campo)} onChange={event => {
                    const checked = event.target.checked;
                    setCampos(atuais => checked ? [...atuais, campo] : atuais.filter(item => item !== campo));
                  }} />
                  {camposExportacao[campo]}
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-textSecondary">Nome do cliente incluído em todas as exportações.</p>
          </fieldset>
        </fieldset>
        {erro && <p role="alert" className="mx-6 mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <span className="mr-auto text-xs font-medium text-textSecondary">Excel · .xlsx</span>
          <button type="button" className="btn-outline" disabled={exportando} onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={exportando}>
            {exportando ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />} {exportando ? "Gerando planilha…" : "Baixar Excel"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
