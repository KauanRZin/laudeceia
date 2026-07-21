import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Insurance, User } from "../types/domain";
import { formatDate } from "../utils/format";
import { ConfirmModal } from "../modals/ConfirmModal";
import { Badge, IconButton } from "./SharedUI";

export function InsuranceCards({ user, insurances, editable, onRemove }: { user: User; insurances: Insurance[]; editable?: boolean; onRemove?: (id: string) => void }) {
  const [insuranceToDelete, setInsuranceToDelete] = useState<string | null>(null);

  if (!insurances.length) return <p className="rounded-lg border border-dashed border-borderSoft p-5 text-sm text-textSecondary">Nenhum seguro vinculado.</p>;
  
  return (
    <div className="grid gap-3">
      {insurances.map((insurance) => {
        const canRemove = editable && (user.role === "Manager" || user.role === "SuperAdmin" || String(insurance.id).startsWith("s"));
        return (
          <article key={insurance.id} className="rounded-lg border border-borderSoft p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-semibold">{insurance.tipoNome}</h3>
                <p className="text-sm text-textSecondary">Vigência: {formatDate(insurance.inicioVigencia)} → {insurance.fimVigencia ? formatDate(insurance.fimVigencia) : "Sem vencimento"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{insurance.vinculoNome}</Badge>
                {canRemove && (
                  <IconButton label="Remover" danger onClick={() => setInsuranceToDelete(insurance.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                )}
              </div>
            </div>
          </article>
        );
      })}
      
      <ConfirmModal
        isOpen={!!insuranceToDelete}
        title="Remover Seguro"
        content="Tem certeza que deseja desvincular este seguro do cliente?"
        onConfirm={() => {
          if (insuranceToDelete && onRemove) onRemove(insuranceToDelete);
          setInsuranceToDelete(null);
        }}
        onCancel={() => setInsuranceToDelete(null)}
      />
    </div>
  );
}