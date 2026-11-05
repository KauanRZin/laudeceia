import { useEffect, useState } from "react";
import { Search, Eye, CalendarDays } from "lucide-react";
import type { User } from "../types/domain";
import type { InsuranceType } from "../api/insuranceTypesApi";
import { getClientActivity, type ClientActivityQuery, type ActivityClient, type PageResult } from "../api/activityApi";
import { normalizeApiError } from "../api/http";
import { Pagination, IconButton } from "../components/SharedUI";
import { formatDate, formatDateTime, formatLocalDate, latestVehiclePlate } from "../utils/format";

export function ClientPeriodSearch({ user, vinculos, insuranceTypes, onView }: {
  user: User; vinculos: string[]; insuranceTypes: InsuranceType[]; onView: (id: string) => Promise<void>;
}) {
  const now = new Date();
  const [inicio, setInicio] = useState(formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [fim, setFim] = useState(formatLocalDate(now));
  const [evento, setEvento] = useState<ClientActivityQuery["evento"]>("todos");
  const [tipoId, setTipoId] = useState("");
  const [vinculo, setVinculo] = useState("");
  const [query, setQuery] = useState<ClientActivityQuery | null>(null);
  const [result, setResult] = useState<PageResult<ActivityClient> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    getClientActivity(query, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult(data);
    }).catch(err => {
      if (!controller.signal.aborted) {
        const apiError = normalizeApiError(err);
        setError(Object.values(apiError.details ?? {})[0] || apiError.message);
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query]);

  async function view(id: string) {
    try { await onView(id); } catch (err) { setError(normalizeApiError(err).message); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Clientes por período</h1>
        <p className="mt-1 text-sm text-textSecondary">Encontre clientes pelos seguros criados ou atualizados no período. Horário de Brasília.</p>
      </div>
      <section className="card">
        <form onSubmit={event => {
          event.preventDefault();
          setQuery({ inicio, fim, evento, tipoId: tipoId ? Number(tipoId) : undefined, vinculo: vinculo || undefined, page: 1 });
        }}>
          <fieldset disabled={loading} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label><span className="label">Data inicial</span><input className="input" type="date" required value={inicio} onChange={event => setInicio(event.target.value)} /></label>
            <label><span className="label">Data final</span><input className="input" type="date" required min={inicio} value={fim} onChange={event => setFim(event.target.value)} /></label>
            <label><span className="label">Data do seguro</span><select className="input" value={evento} onChange={event => setEvento(event.target.value as ClientActivityQuery["evento"])}>
              <option value="todos">Criação ou última atualização</option><option value="criados">Criação</option><option value="atualizados">Última atualização</option>
            </select></label>
            <label><span className="label">Tipo de seguro</span><select className="input" value={tipoId} onChange={event => setTipoId(event.target.value)}>
              <option value="">Todos</option>{insuranceTypes.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}
            </select></label>
            <label><span className="label">Vínculo do seguro</span><select className="input" value={vinculo} onChange={event => setVinculo(event.target.value)}>
              <option value="">Todos os vínculos permitidos</option>{(user.role === "Funcionário" ? user.vinculos : vinculos).map(nome => <option key={nome}>{nome}</option>)}
            </select></label>
            <button className="btn-primary" type="submit"><Search size={16} />{loading ? "Buscando…" : "Buscar clientes"}</button>
          </fieldset>
        </form>
      </section>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p role="status" className="text-sm text-textSecondary">Buscando registros…</p>}
      {!query && <div className="card flex items-center gap-3 text-sm text-textSecondary"><CalendarDays size={20} />Selecione o período para iniciar a busca.</div>}
      {result && (
        <section className="card">
          {result.items.length === 0 ? <p className="text-sm text-textSecondary">Nenhum cliente encontrado com esses filtros.</p> : (
            <div className="table-wrap"><table className="data-table">
              <thead><tr><th>Cliente</th><th>CPF</th><th>Última placa informada</th><th>Seguros no período</th><th>Ações</th></tr></thead>
              <tbody>{result.items.map(client => <tr key={client.id}>
                <td className="font-medium">{client.nome}</td>
                <td className="whitespace-nowrap">{client.cpf || "—"}</td>
                <td className="whitespace-nowrap font-medium">{latestVehiclePlate(client.observacao) || "—"}</td>
                <td><div className="space-y-3">{client.seguros.map(seguro => <div key={seguro.id}>
                  <p className="font-medium">{seguro.tipoNome} · {seguro.vinculoNome}</p>
                  <p className="text-sm text-textSecondary">Vigência de {formatDate(seguro.inicioVigencia)} {seguro.fimVigencia ? `a ${formatDate(seguro.fimVigencia)}` : "· Sem vencimento"}</p>
                  <p className="text-xs text-textSecondary">Criado em {formatDateTime(seguro.createdAt)} · Atualizado em {formatDateTime(seguro.updatedAt)}</p>
                </div>)}</div></td>
                <td><IconButton label="Ver cliente" onClick={() => void view(client.id)}><Eye size={17} /></IconButton></td>
              </tr>)}</tbody>
            </table></div>
          )}
          <Pagination page={result.page} total={result.total} pageSize={result.pageSize} disabled={loading} onChange={page => setQuery(current => current && { ...current, page })} />
        </section>
      )}
    </div>
  );
}
