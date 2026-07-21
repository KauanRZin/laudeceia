import { useMemo } from "react";
import { CalendarDays, Users, CheckCircle2 } from "lucide-react";
import type { Client, User, RenewalRow } from "../types/domain";
import { formatDate } from "../utils/format";
import { MetricCard, Banner, StatusBadge } from "../components/SharedUI";

// Função extraída do original[cite: 2]
function computeRenewals(clients: Client[], rangeStart: string, rangeEnd: string) {
  const start = new Date(`${rangeStart}T00:00:00`);
  const end = new Date(`${rangeEnd}T23:59:59`);
  const novos: any[] = [];
  const expiring: any[] = [];

  for (const client of clients) {
    for (const seguro of client.seguros) {
      const inicio = new Date(`${seguro.inicioVigencia}T00:00:00`);
      const fim = seguro.fimVigencia ? new Date(`${seguro.fimVigencia}T00:00:00`) : null;
      if (inicio >= start && inicio <= end) novos.push({ clientId: client.id, seguroId: seguro.id, cliente: client.nome, tipo: seguro.tipoNome, vinculo: seguro.vinculoNome, inicio: seguro.inicioVigencia, fim: seguro.fimVigencia, status: "Novo" });
      if (fim !== null && fim >= start && fim <= end) {
        const dias = Math.ceil((fim.getTime() - new Date().getTime()) / 86_400_000);
        expiring.push({ clientId: client.id, seguroId: seguro.id, cliente: client.nome, tipo: seguro.tipoNome, vinculo: seguro.vinculoNome, fim: seguro.fimVigencia, dias, status: "Expirando" });
      }
    }
  }
  return { novos, expiring };
}

function RenewalTable({ title, rows, mode, onRenew }: { title: string; rows: any[]; mode: "active" | "expiring"; onRenew?: (row:any) => void }) {
  return (
    <div>
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-borderSoft p-5 text-sm text-textSecondary">Nenhum registro no período selecionado.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>{mode === "active" ? ["Cliente", "Tipo de Seguro", "Vínculo", "Início", "Fim", "Status"].map((h) => <th key={h}>{h}</th>) : ["Cliente", "Tipo de Seguro", "Vínculo", "Fim", "Dias restantes", "Ação"].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.cliente}-${row.tipo}`}>
                  <td className="font-medium">{row.cliente}</td>
                  <td>{row.tipo}</td>
                  <td>{row.vinculo}</td>
                  {mode === "active" && <td>{row.inicio ? formatDate(row.inicio) : "—"}</td>}
                  <td>{row.fim ? formatDate(row.fim) : "Sem vencimento"}</td>
                  {mode === "active" ? <td><StatusBadge status="Ativo" /></td> : <td>{row.dias} dias</td>}
                  {mode === "expiring" && <td><button className="btn-primary btn-small" onClick={()=>onRenew && onRenew(row)}>Renovar</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Dashboard({ user, clients, loading, rangeStart, rangeEnd, onRangeStartChange, onRangeEndChange, onRenew }: any) {
  const { novos: activeRenewals, expiring: expiringRenewals } = useMemo(
    () => computeRenewals(clients, rangeStart, rangeEnd),
    [clients, rangeStart, rangeEnd]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-textSecondary">Visão operacional de clientes, seguros e renovações.</p>
        </div>
        {user.role === "Funcionário" && <Banner>Exibindo seguros do seu vínculo: {user.vinculos[0]}</Banner>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard icon={<Users />} label="Total de Clientes" value={clients.length} />
        <MetricCard icon={<CheckCircle2 />} label="Seguros Ativos" value={clients.reduce((sum: number, client: Client) => sum + client.seguros.length, 0)} />
      </div>
      <section className="card">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="section-title">Seguros próximos do vencimento</h2>
            <p className="text-sm text-textSecondary">Selecione o período desejado.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <CalendarDays size={18} className="text-primary" />
            <input className="input w-40" type="date" value={rangeStart} onChange={(e) => onRangeStartChange(e.target.value)} />
            <span className="text-textSecondary">até</span>
            <input className="input w-40" type="date" value={rangeEnd} onChange={(e) => onRangeEndChange(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-textSecondary">Carregando dados...</p>
        ) : (
          <div className="mt-8">
            <RenewalTable title="Expirando no período" rows={expiringRenewals} mode="expiring" onRenew={onRenew} />
          </div>
        )}
      </section>
    </div>
  );
}