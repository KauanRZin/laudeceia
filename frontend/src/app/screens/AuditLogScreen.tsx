import { useEffect, useState } from "react";
import { History, Search } from "lucide-react";
import { auditActions, getAuditLogs, type AuditQuery, type AuditEntry, type PageResult } from "../api/activityApi";
import { normalizeApiError } from "../api/http";
import { Pagination } from "../components/SharedUI";
import { formatDate, formatDateTime, formatLocalDate } from "../utils/format";

function snapshotValue(snapshot: Record<string, unknown> | null, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) =>
    value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, snapshot);
}

function displayValue(value: unknown, path: string): string {
  if (value == null || value === "") return path === "fimVigencia" ? "Sem vencimento" : "—";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (["nascimento", "inicioVigencia", "fimVigencia"].includes(path)) return formatDate(String(value).slice(0, 10));
  return String(value);
}

export function getAuditDetails(entry: AuditEntry) {
  const clientFields = [
    ["nome", "Nome"], ["cpf", "CPF"], ["telefone", "Telefone"], ["nascimento", "Nascimento"],
    ["observacao", "Observações"], ["vinculos", "Vínculos"], ["endereco.cep", "CEP"],
    ["endereco.logradouro", "Logradouro"], ["endereco.numero", "Número"], ["endereco.complemento", "Complemento"],
    ["endereco.bairro", "Bairro"], ["endereco.cidade", "Cidade"], ["endereco.estado", "Estado"],
  ];
  const insuranceFields = [["tipo.nome", "Tipo de seguro"], ["vinculo.nome", "Vínculo"], ["inicioVigencia", "Início da vigência"], ["fimVigencia", "Fim da vigência"]];
  if (entry.action === "IMPORT_COMPLETED") return [];
  const fields = entry.action.startsWith("CLIENT_") ? clientFields : insuranceFields;
  return fields.flatMap(([path, label]) => {
    const before = snapshotValue(entry.before, path);
    const after = snapshotValue(entry.after, path);
    if (entry.before && entry.after && JSON.stringify(before) === JSON.stringify(after)) return [];
    if (before === undefined && after === undefined) return [];
    return [{ path, label, before: displayValue(before, path), after: displayValue(after, path) }];
  });
}

function AuditDetails({ entry }: { entry: AuditEntry }) {
  const rows = getAuditDetails(entry);
  if (rows.length === 0) return null;
  const updated = Boolean(entry.before && entry.after);
  return <details className="mt-3">
    <summary className="cursor-pointer text-sm font-medium text-primary">{updated ? "Ver alterações" : entry.before ? "Ver dados excluídos" : "Ver dados cadastrados"}</summary>
    <div className="table-wrap mt-3"><table className="data-table text-sm">
      <thead><tr><th>Campo</th>{updated ? <><th>Antes</th><th>Depois</th></> : <th>{entry.before ? "Dados anteriores" : "Dados cadastrados"}</th>}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.path}>
        <td className="font-medium">{row.label}</td>
        {updated ? <><td className="whitespace-pre-line break-words">{row.before}</td><td className="whitespace-pre-line break-words">{row.after}</td></> : <td className="whitespace-pre-line break-words">{entry.before ? row.before : row.after}</td>}
      </tr>)}</tbody>
    </table></div>
  </details>;
}

export function AuditLogScreen() {
  const now = new Date();
  const [inicio, setInicio] = useState(formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [fim, setFim] = useState(formatLocalDate(now));
  const [action, setAction] = useState<AuditQuery["action"]>();
  const [query, setQuery] = useState<AuditQuery>(() => ({ inicio, fim, page: 1 }));
  const [result, setResult] = useState<PageResult<AuditEntry> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    getAuditLogs(query, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult(data);
    }).catch(err => {
      if (!controller.signal.aborted) {
        const apiError = normalizeApiError(err);
        setError(Object.values(apiError.details ?? {})[0] || apiError.message);
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-blue-50 p-3 text-primary"><History size={24} /></span>
        <div><h1 className="page-title">Histórico de operações</h1><p className="mt-1 text-sm text-textSecondary">Clientes, seguros e importações · Horário de Brasília</p></div>
      </div>
      <section className="card">
        <form onSubmit={event => { event.preventDefault(); setQuery({ inicio, fim, action, page: 1 }); }}>
          <fieldset disabled={loading} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label><span className="label">Data inicial</span><input className="input" type="date" required value={inicio} onChange={event => setInicio(event.target.value)} /></label>
            <label><span className="label">Data final</span><input className="input" type="date" required min={inicio} value={fim} onChange={event => setFim(event.target.value)} /></label>
            <label><span className="label">Operação</span><select className="input" value={action || ""} onChange={event => setAction(event.target.value ? event.target.value as AuditQuery["action"] : undefined)}>
              <option value="">Todas</option>{Object.entries(auditActions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <button type="submit" className="btn-primary"><Search size={16} />{loading ? "Buscando…" : "Filtrar histórico"}</button>
          </fieldset>
        </form>
      </section>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p role="status" className="text-sm text-textSecondary">Carregando histórico…</p>}
      {result && <section className="card">
        {result.items.length === 0 ? <p className="text-sm text-textSecondary">Nenhuma operação registrada neste período.</p> : (
          <div className="divide-y divide-slate-100">{result.items.map(entry => (
            <article key={entry.id} className="py-4 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${entry.action.endsWith("_DELETED") ? "bg-red-50 text-red-700" : "bg-blue-50 text-primary"}`}>{auditActions[entry.action]}</span>
                  <h2 className="mt-2 font-semibold">{entry.clientName || "Importação de planilha"}</h2>
                </div>
                <p className="text-xs text-textSecondary">{formatDateTime(entry.createdAt)} · {entry.actorName}</p>
              </div>
              <p className="mt-1 text-sm text-textSecondary">{entry.summary}</p>
              <AuditDetails entry={entry} />
            </article>
          ))}</div>
        )}
        <Pagination page={result.page} total={result.total} pageSize={result.pageSize} disabled={loading} onChange={page => setQuery(current => ({ ...current, page }))} />
      </section>}
    </div>
  );
}
