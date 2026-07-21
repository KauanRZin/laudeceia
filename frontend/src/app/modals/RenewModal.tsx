import { useState } from "react";
import { X } from "lucide-react";
import { formatDate } from "../utils/format";
import { Field } from "../components/SharedUI";

export function RenewModal({ row, onClose, onSave }: { row: any; onClose: () => void; onSave: (clientId: string, insuranceId: string, novaData: string) => void; }) {
  const [novaData, setNovaData] = useState(row.fim || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
      <section className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-title">Renovar Seguro</h2>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-textSecondary">
            <strong>Cliente:</strong> {row.cliente}<br />
            <strong>Seguro:</strong> {row.tipo}<br />
            <strong>Vencimento atual:</strong> {formatDate(row.fim)}
          </p>
          <Field label="Nova data de vencimento" type="date" value={novaData} onChange={setNovaData} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => onSave(row.clientId, row.seguroId, novaData)}>Atualizar Data</button>
        </div>
      </section>
    </div>
  );
}