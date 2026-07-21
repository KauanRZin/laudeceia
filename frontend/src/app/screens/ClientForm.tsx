import { useState, useEffect } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { buscarDadosCep } from "../api/buscacep";
import { maskCPF, maskPhone, maskCEP } from "../utils/format";
import type { Client, User } from "../types/domain";
import { Field, Select, ActionBar, Breadcrumb } from "../components/SharedUI";
import { InsuranceCards } from "../components/InsuranceCards";
import { ClientReviewModal } from "../modals/ClientReviewModal";

export function ClientForm({ user, client, vinculos, setClient, onCancel, onSave, onAddInsurance }: any) {
  const isManager = user.role === "Manager" || user.role === "SuperAdmin";
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showReview, setShowReview] = useState(false);

  const update = (patch: Partial<Client>) => setClient((curr: Client) => ({ ...curr, ...patch }));
  const updateAddress = (key: keyof Client["endereco"], val: string) => setClient((curr: Client) => ({ ...curr, endereco: { ...curr.endereco, [key]: val } }));

  useEffect(() => {
    const cepLimpo = client.endereco.cep.replace(/\D/g, "");
    if (cepLimpo.length === 8) {
      buscarDadosCep(cepLimpo).then((data) => {
        if (data) {
          setClient((curr: Client) => ({ ...curr, endereco: { ...curr.endereco, logradouro: data.logradouro, bairro: data.bairro, cidade: data.localidade, estado: data.uf } }));
          setErrors((prev) => ({ ...prev, cep: "", logradouro: "", bairro: "", cidade: "", estado: "" }));
        }
      });
    }
  }, [client.endereco.cep, setClient]);

  function handleRequestSave() {
    const newErrors: Record<string, string> = {};
    if (!client.nome || client.nome.trim().length < 2) newErrors.nome = "Nome é obrigatório.";
    if (client.cpf.replace(/\D/g, "").length !== 11) newErrors.cpf = "CPF deve ter 11 dígitos.";
    if (!client.nascimento) newErrors.nascimento = "Data de nascimento é obrigatória.";
    if (client.telefone.replace(/\D/g, "").length < 10) newErrors.telefone = "Telefone inválido.";
    if (client.endereco.cep.replace(/\D/g, "").length !== 8) newErrors.cep = "CEP inválido.";
    if (!client.endereco.logradouro) newErrors.logradouro = "Logradouro é obrigatório.";
    if (!client.endereco.numero) newErrors.numero = "Número é obrigatório.";
    if (!client.endereco.bairro) newErrors.bairro = "Bairro é obrigatório.";
    if (!client.endereco.cidade) newErrors.cidade = "Cidade é obrigatória.";
    if (!client.endereco.estado) newErrors.estado = "Estado é obrigatório.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) setShowReview(true);
  }

  async function confirmSave() {
    setShowReview(false);
    try {
      await onSave(client);
    } catch (error: any) {
      if (error.details) setErrors(error.details);
    }
  }

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <Breadcrumb items={["Clientes", client.nome || "Novo Cliente", client.id ? "Editar" : "Novo"]} onBack={onCancel} />
      <section className="card">
        <h1 className="page-title mb-5">{client.id ? "Editar Cliente" : "Novo Cliente"}</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome Completo" value={client.nome} onChange={(v) => { update({ nome: v }); setErrors({ ...errors, nome: "" }); }} error={errors.nome} />
          <Field label="CPF" value={client.cpf} onChange={(v) => { update({ cpf: maskCPF(v) }); setErrors({ ...errors, cpf: "" }); }} placeholder="000.000.000-00" error={errors.cpf} />
          <Field label="Data de Nascimento" type="date" value={client.nascimento} onChange={(v) => { update({ nascimento: v }); setErrors({ ...errors, nascimento: "" }); }} error={errors.nascimento} />
          <Field label="Telefone" value={client.telefone} onChange={(v) => { update({ telefone: maskPhone(v) }); setErrors({ ...errors, telefone: "" }); }} placeholder="(00) 00000-0000" error={errors.telefone} />
          <label className="block md:col-span-2"><span className="label">Observação</span><textarea className="input min-h-24" value={client.observacao} onChange={(e) => update({ observacao: e.target.value })} /></label>
        </div>
      </section>
      <section className="card">
        <h2 className="section-title mb-4">Endereço</h2>
        <div className="grid gap-4 md:grid-cols-6">
          <Field label="CEP" value={client.endereco.cep} onChange={(v) => { updateAddress("cep", maskCEP(v)); setErrors({ ...errors, cep: "" }); }} className="md:col-span-1" error={errors.cep} />
          <Field label="Logradouro" value={client.endereco.logradouro} onChange={(v) => { updateAddress("logradouro", v); setErrors({ ...errors, logradouro: "" }); }} className="md:col-span-3" error={errors.logradouro} />
          <Field label="Número" value={client.endereco.numero} onChange={(v) => { updateAddress("numero", v); setErrors({ ...errors, numero: "" }); }} className="md:col-span-2" error={errors.numero} />
          <Field label="Complemento" value={client.endereco.complemento} onChange={(v) => updateAddress("complemento", v)} className="md:col-span-2" />
          <Field label="Bairro" value={client.endereco.bairro} onChange={(v) => { updateAddress("bairro", v); setErrors({ ...errors, bairro: "" }); }} className="md:col-span-2" error={errors.bairro} />
          <Field label="Cidade" value={client.endereco.cidade} onChange={(v) => { updateAddress("cidade", v); setErrors({ ...errors, cidade: "" }); }} className="md:col-span-1" error={errors.cidade} />
          <Field label="Estado" value={client.endereco.estado} onChange={(v) => { updateAddress("estado", v); setErrors({ ...errors, estado: "" }); }} className="md:col-span-1" error={errors.estado} />
        </div>
      </section>
      <section className="card">
        <h2 className="section-title mb-4">Vínculos do Cliente</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Vínculo primário" value={client.vinculos[0] || user.vinculos[0]} disabled={!isManager} onChange={(v) => update({ vinculos: [v, ...client.vinculos.slice(1)] })} options={vinculos} />
          {isManager && client.vinculos.length > 1 && (
            <div className="flex items-end gap-2">
              <div className="flex-1"><Select label="Vínculo secundário" value={client.vinculos[1]} onChange={(v) => update({ vinculos: [client.vinculos[0], v] })} options={vinculos} /></div>
              <button type="button" className="mb-0.5 flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-red-500 text-red-500 transition-colors hover:bg-red-50" onClick={() => update({ vinculos: [client.vinculos[0]] })}><Trash2 size={18} /></button>
            </div>
          )}
        </div>
        {isManager && client.vinculos.length < 2 && <button className="mt-4 text-sm font-semibold text-primary" onClick={() => update({ vinculos: [client.vinculos[0] || vinculos[0], vinculos[1]] })}>+ Adicionar segundo vínculo</button>}
      </section>
      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Seguros Vinculados</h2>
          <button className="btn-primary" onClick={onAddInsurance}><Plus size={16} /> Adicionar Seguro</button>
        </div>
        <InsuranceCards user={user} insurances={client.seguros} editable onRemove={(idToRemove) => update({ seguros: client.seguros.filter((s:any) => s.id !== idToRemove) })} />
      </section>
      <ActionBar>
        <button className="btn-outline" onClick={onCancel}>Cancelar</button>
        <button className="btn-primary" onClick={handleRequestSave}><Save size={16} /> Salvar Cliente</button>
      </ActionBar>

      <ClientReviewModal isOpen={showReview} client={client} onConfirm={confirmSave} onCancel={() => setShowReview(false)} />
    </div>
  );
}