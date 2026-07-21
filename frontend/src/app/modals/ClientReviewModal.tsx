import type { Client } from "../types/domain";

interface ClientReviewModalProps {
  isOpen: boolean;
  client: Client;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ClientReviewModal({ isOpen, client, onConfirm, onCancel }: ClientReviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-4">
      <section className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="section-title mb-4 text-primary">Revisar Dados do Cliente</h2>
        <div className="mb-6 space-y-3 text-sm text-textSecondary max-h-96 overflow-y-auto">
          <p><strong>Nome:</strong> {client.nome}</p>
          <p><strong>CPF:</strong> {client.cpf}</p>
          <p><strong>Telefone:</strong> {client.telefone}</p>
          <p><strong>Endereço:</strong> {client.endereco.logradouro}, {client.endereco.numero} - {client.endereco.cidade}/{client.endereco.estado}</p>
          <p><strong>Vínculos:</strong> {client.vinculos.join(", ")}</p>
          <p><strong>Seguros:</strong> {client.seguros.length} cadastrado(s)</p>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-outline" onClick={onCancel}>Voltar para Edição</button>
          <button className="btn-primary" onClick={onConfirm}>Confirmar e Salvar</button>
        </div>
      </section>
    </div>
  );
}