import { useState, useEffect } from "react";
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Upload, Download, Plus, Eye, Edit, Trash2 } from "lucide-react";
import type { Client, User } from "../types/domain";
import { Banner, IconButton, Pills } from "../components/SharedUI";
import { ConfirmModal } from "../modals/ConfirmModal";

export function ClientList({ user, clients, vinculos, loading, onNew, onEdit, onView, onDelete }: any) {
  const [search, setSearch] = useState("");
  const [vinculo, setVinculo] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="page-title">Clientes Cadastrados</h1>
          {user.role === "Funcionário" && <Banner>Exibindo clientes do seu vínculo: {user.vinculos[0]}</Banner>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline"><Upload size={16} /> Importar Dados</button>
          <button className="btn-outline"><Download size={16} /> Exportar Dados</button>
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