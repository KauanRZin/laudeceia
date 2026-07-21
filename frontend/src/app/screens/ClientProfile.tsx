import { Edit } from "lucide-react";
import type { Client, User } from "../types/domain";
import { formatDate } from "../utils/format";
import { Avatar, Breadcrumb, Detail, Pills } from "../components/SharedUI";
import { InsuranceCards } from "../components/InsuranceCards";

export function ClientProfile({ user, client, onBack, onEdit }: { user: User; client: Client; onBack: () => void; onEdit: () => void }) {
  return (
    <div className="space-y-5">
      <Breadcrumb items={["Clientes", client.nome]} onBack={onBack} />
      <section className="card">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div className="flex gap-4">
            <Avatar name={client.nome} />
            <div>
              <h1 className="page-title">{client.nome}</h1>
              <p className="text-sm text-textSecondary">{client.cpf} • {client.telefone} • {formatDate(client.nascimento)}</p>
              <div className="mt-3"><Pills values={client.vinculos} /></div>
            </div>
          </div>
          <button className="btn-primary" onClick={onEdit}><Edit size={16} /> Editar Cliente</button>
        </div>
      </section>
      <section className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="card">
          <h2 className="section-title mb-4">Dados Pessoais</h2>
          <Detail label="Endereço" value={`${client.endereco.logradouro}, ${client.endereco.numero}, ${client.endereco.complemento || "sem complemento"}, ${client.endereco.bairro}, ${client.endereco.cidade} - ${client.endereco.estado}`} />
          <Detail label="Observações" value={client.observacao || "Sem observações"} />
        </div>
        <div className="card">
          <h2 className="section-title mb-4">Seguros Vinculados</h2>
          <InsuranceCards user={user} insurances={client.seguros} editable={false} />
        </div>
      </section>
    </div>
  );
}