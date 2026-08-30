import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, Eye, Edit, Trash2 } from "lucide-react";
import type { Client, User } from "../types/domain";
import { Banner, IconButton, Pills } from "../components/SharedUI";
import { ConfirmModal } from "../modals/ConfirmModal";
import { ImportadorPlanilha } from "../components/importSistem";
import { formatDate } from "../utils/format";

// ---------------------------------------------------------------------------
// Exportação de clientes (.xlsx)
// ---------------------------------------------------------------------------

function formatEndereco(endereco?: Client["endereco"]) {
  if (!endereco) return "—";
  const partes = [endereco.logradouro, endereco.numero, endereco.complemento, endereco.bairro, endereco.cidade, endereco.estado].filter(Boolean);
  return partes.length ? partes.join(", ") : "—";
}

function formatSeguro(seguro?: { inicioVigencia?: string; fimVigencia?: string | null }) {
  if (!seguro) return "—";
  const inicio = seguro.inicioVigencia ? formatDate(seguro.inicioVigencia) : "—";
  const fim = seguro.fimVigencia ? formatDate(seguro.fimVigencia) : "Sem vencimento";
  return `${inicio} a ${fim}`;
}

function exportarClientes(lista: Client[], rotuloArquivo: string) {
  const linhas = lista.map((client) => ({
    Nome: client.nome,
    "Data de Nascimento": client.nascimento ? formatDate(client.nascimento) : "—",
    CPF: client.cpf,
    Telefone: client.telefone,
    Endereço: formatEndereco(client.endereco),
    "Seguro de Vida": formatSeguro(client.seguros.find((s: any) => s.tipoNome === "Seguro Vida")),
    "Seguro Auto": formatSeguro(client.seguros.find((s: any) => s.tipoNome === "Seguro Auto")),
    "Seguro RE": formatSeguro(client.seguros.find((s: any) => s.tipoNome === "Seguro RE")),
  }));

  const planilha = XLSX.utils.json_to_sheet(linhas);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, "Clientes");

  const dataHoje = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `clientes_${rotuloArquivo}_${dataHoje}.xlsx`);
}

interface ClientListProps {
  user: User;
  clients: Client[];
  vinculos: string[];
  loading: boolean;
  onNew: () => void;
  onEdit: (client: Client) => void;
  onView: (client: Client) => void;
  onDelete: (id: string) => void;
  // 👇 Mudamos aqui: removida a dependência do App.tsx. Usando 'any' para simplificar o repasse.
  onImport: (importacao: any, vinculoPadrao: string) => Promise<void>; 
}

export function ClientList({ 
  user, 
  clients, 
  vinculos, 
  loading, 
  onNew, 
  onEdit, 
  onView, 
  onDelete, 
  onImport 
}: ClientListProps) {
  const [search, setSearch] = useState("");
  const [vinculo, setVinculo] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  const isManager = user.role === "Manager" || user.role === "SuperAdmin";

  const itemsPerPage = 15;

  const filtered = clients.filter((client: Client) => {
    const term = search.toLowerCase();
    const bySearch = client.nome.toLowerCase().includes(term) || client.cpf.includes(search) || (client.observacao || "").toLowerCase().includes(term);
    const byVinculo = vinculo === "Todos" || client.vinculos.includes(vinculo);
    return bySearch && byVinculo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

  useEffect(() => setCurrentPage(1), [search, vinculo]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);

  const pageClients = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const displayedClients = sortDirection ? [...pageClients].sort((a, b) => sortDirection === "asc" ? a.nome.localeCompare(b.nome, "pt-BR") : b.nome.localeCompare(a.nome, "pt-BR")) : pageClients;

  // Exportação respeita só o filtro de vínculo/agência ("Todos" ou uma agência específica),
  // sem levar em conta o texto da busca — são filtros independentes.
  const clientsParaExportar = vinculo === "Todos" ? clients : clients.filter((client: Client) => client.vinculos.includes(vinculo));
  const rotuloExportacao = vinculo === "Todos" ? "todos" : vinculo.trim().replace(/\s+/g, "_").toLowerCase();

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="page-title">Clientes Cadastrados</h1>
          {user.role === "Funcionário" && <Banner>Exibindo clientes do seu vínculo: {user.vinculos[0]}</Banner>}
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportadorPlanilha 
            onImport={onImport} 
            vinculoPadrao={user.vinculos[0] || vinculos[0]} 
          />
          {isManager && (
            <button
              className="btn-outline disabled:cursor-not-allowed disabled:opacity-50"
              disabled={clientsParaExportar.length === 0}
              title={clientsParaExportar.length === 0 ? "Nenhum cliente para exportar com o filtro atual" : undefined}
              onClick={() => exportarClientes(clientsParaExportar, rotuloExportacao)}
            >
              <Download size={16} /> Exportar Dados
            </button>
          )}
          <button className="btn-primary" onClick={onNew}><Plus size={16} /> Novo Cliente</button>
        </div>
      </div>
      <section className="card">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-textSecondary" size={18} />
            <input className="input pl-10" placeholder="Buscar por nome, CPF ou observação" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {(user.role === "Manager" || user.role === "SuperAdmin") && (
            <select className="input" value={vinculo} onChange={(e) => setVinculo(e.target.value)}>
              <option>Todos</option>
              {vinculos.map((item: string) => <option key={item}>{item}</option>)}
            </select>
          )}
        </div>
        {loading ? (
          <p className="text-sm text-textSecondary">Carregando clientes...</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th><button type="button" className="flex items-center gap-1 font-semibold" onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}>Nome {sortDirection === "asc" && <ChevronUp size={14} />} {sortDirection === "desc" && <ChevronDown size={14} />}</button></th>
                    <th>Observações</th>
                    <th>CPF</th>
                    <th>Telefone</th>
                    <th>Vínculos</th>
                    <th>Nº de Seguros</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedClients.map((client: Client) => (
                    <tr key={client.id}>
                      <td className="font-medium">{client.nome}</td>
                      <td className="max-w-[220px] truncate text-sm text-textSecondary">{client.observacao || "—"}</td>
                      <td>{client.cpf}</td>
                      <td>{client.telefone}</td>
                      <td><Pills values={client.vinculos} /></td>
                      <td>{client.seguros.length}</td>
                      <td>
                        <div className="flex gap-1">
                          <IconButton label="Visualizar" onClick={() => onView(client)}><Eye size={17} /></IconButton>
                          <IconButton label="Editar" onClick={() => onEdit(client)}><Edit size={17} /></IconButton>
                          {(user.role === "Manager" || user.role === "SuperAdmin") && <IconButton label="Excluir" danger onClick={() => setClientToDelete(client.id)}><Trash2 size={17} /></IconButton>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-textSecondary">Página {currentPage} de {totalPages}</p>
              <div className="flex items-center gap-2">
                <IconButton label="Anterior" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}><ChevronLeft size={17} /></IconButton>
                <IconButton label="Próxima" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}><ChevronRight size={17} /></IconButton>
              </div>
            </div>
          </>
        )}
      </section>
      
      <ConfirmModal
        isOpen={!!clientToDelete}
        title="Excluir Cliente"
        content="Tem certeza que deseja excluir este cliente? Todos os seguros vinculados a ele também serão apagados permanentemente."
        onConfirm={() => { if (clientToDelete) onDelete(clientToDelete); setClientToDelete(null); }}
        onCancel={() => setClientToDelete(null)}
      />
    </div>
  );
}