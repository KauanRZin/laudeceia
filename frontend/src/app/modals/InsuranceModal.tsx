import { useState } from "react";
import { X } from "lucide-react";
import type { Client, Insurance, User } from "../types/domain";
import type { InsuranceType } from "../api/insuranceTypesApi";
import type { Vinculo } from "../api/vinculosApi";
import { Field, Select } from "../components/SharedUI";

function makeBlankInsurance(defaultType?: InsuranceType, defaultVinculo?: Vinculo): Insurance {
  return { id: "", tipoId: defaultType?.id ?? 0, tipoNome: defaultType?.nome ?? "", inicioVigencia: "", fimVigencia: null, vinculoId: defaultVinculo?.id ?? 0, vinculoNome: defaultVinculo?.nome ?? "" };
}

export function InsuranceModal({ user, client, vinculos, insuranceTypes, onClose, onSave }: { user: User; client: Client; vinculos: Vinculo[]; insuranceTypes: InsuranceType[]; onClose: () => void; onSave: (insurance: Insurance) => void; }) {
  const defaultVinculoNome = user.role === "Funcionário" ? user.vinculos[0] : client.vinculos[0] || vinculos[0]?.nome || "";
  const defaultVinculo = vinculos.find((item) => item.nome === defaultVinculoNome);
  const [insurance, setInsurance] = useState<Insurance>(makeBlankInsurance(insuranceTypes[0], defaultVinculo));
  const [error, setError] = useState("");

  const selectedType = insuranceTypes.find((type) => type.id === insurance.tipoId);
  const isLife = selectedType?.nome === "Seguro de Vida";
  const vinculoOptions = (user.role === "Manager" || user.role === "SuperAdmin") ? vinculos.map((item) => item.nome) : user.vinculos;

  function handleSave() {
    if (!insurance.inicioVigencia) {
      setError("O início de vigência é obrigatório.");
      return;
    }
    setError("");
    onSave({ ...insurance, fimVigencia: isLife ? null : insurance.fimVigencia });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
      <section className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-title">Adicionar Seguro</h2>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <Select label="Tipo de Seguro" value={String(insurance.tipoId)} onChange={(val) => { const type = insuranceTypes.find((item) => item.id === Number(val)); setInsurance((curr) => ({ ...curr, tipoId: Number(val), tipoNome: type?.nome ?? "", fimVigencia: type?.nome === "Seguro de Vida" ? null : curr.fimVigencia })); }} options={insuranceTypes.map((type) => ({ label: `${type.id} - ${type.nome}`, value: String(type.id) }))} />
          <Field label="Início de Vigência" type="date" value={insurance.inicioVigencia} onChange={(val) => { setInsurance({ ...insurance, inicioVigencia: val }); setError(""); }} error={error} />
          {isLife ? (
            <p className="rounded-lg bg-blue-50 p-3 text-sm text-primary">Seguro de Vida não possui fim de vigência.</p>
          ) : (
            <Field label="Fim de Vigência" type="date" value={insurance.fimVigencia || ""} onChange={(val) => setInsurance({ ...insurance, fimVigencia: val })} />
          )}
          <Select label="Vínculo" value={insurance.vinculoNome} disabled={user.role === "Funcionário"} onChange={(val) => { const vinc = vinculos.find((item) => item.nome === val); setInsurance({ ...insurance, vinculoNome: val, vinculoId: vinc?.id ?? 0 }); }} options={vinculoOptions} />
          {user.role === "Funcionário" && <p className="text-xs text-textSecondary">Seguros só podem ser vinculados à sua agência: {user.vinculos[0]}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave}>Salvar Seguro</button>
        </div>
      </section>
    </div>
  );
}