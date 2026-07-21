import { useState, useEffect } from "react";
import { Lock, Edit, CheckCircle2, Plus } from "lucide-react";
import type { Role, User } from "../types/domain";
import * as usersApi from "../api/usersApi";
import { normalizeApiError } from "../api/http";
import { IconButton, StatusBadge, Breadcrumb, Field, Select } from "../components/SharedUI";

// --- HOOK ISOLADO DE USUÁRIOS (Pode ser transferido para hooks/useUsers.ts) ---
export function useUsers(currentUser: User | null, notify: (msg: string) => void) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || (currentUser.role !== "Manager" && currentUser.role !== "SuperAdmin")) return;
    setLoading(true);
    usersApi.getUsers().then(setUsers).catch((err) => notify(normalizeApiError(err).message)).finally(() => setLoading(false));
  }, [currentUser, notify]);

  async function saveUser(user: User) {
    try {
      const saved = await usersApi.saveUser(user);
      setUsers((prev) => (user.id ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev]));
      notify("Usuário salvo com sucesso.");
    } catch (error) { notify(normalizeApiError(error).message); }
  }

  async function toggleUserStatus(user: User) {
    if (user.role === "SuperAdmin") return;
    try {
      const saved = await usersApi.updateUserStatus(user.id, user.status === "Ativo" ? "Inativo" : "Ativo");
      setUsers((prev) => prev.map((item) => (item.id === user.id ? saved : item)));
    } catch (error) { notify(normalizeApiError(error).message); }
  }

  return { users, loading, saveUser, toggleUserStatus };
}

// --- TELAS ---
export function UserManagement({ users, loading, onNew, onEdit, onToggle }: any) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Usuários do Sistema</h1>
        <button className="btn-primary" onClick={onNew}><Plus size={16} /> Novo Usuário</button>
      </div>
      <section className="card table-wrap">
        {loading ? <p className="p-4 text-sm text-textSecondary">Carregando usuários...</p> : (
          <table className="data-table">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Vínculo</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {users.map((user: User) => {
                const locked = user.role === "SuperAdmin";
                return (
                  <tr key={user.id} className={locked ? "bg-slate-50 text-inactive" : ""} title={locked ? "Usuário de sistema — não editável" : ""}>
                    <td className="font-medium">{locked && <Lock className="mr-2 inline" size={15} />}{user.nome}</td>
                    <td>{user.email}</td><td>{user.role}</td><td>{user.vinculos.length ? user.vinculos.join(", ") : "—"}</td>
                    <td><StatusBadge status={user.status} /></td>
                    <td>
                      <div className="flex gap-1">
                        <IconButton label="Editar" disabled={locked} onClick={() => onEdit(user)}><Edit size={17} /></IconButton>
                        <IconButton label="Alternar status" disabled={locked} onClick={() => onToggle(user)}><CheckCircle2 size={17} /></IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export function UserForm({ user, vinculos, setUser, onCancel, onSave }: any) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = (patch: Partial<User>) => setUser((curr: User) => ({ ...curr, ...patch }));

  function handleSubmit() {
    const newErrors: Record<string, string> = {};
    if (!user.nome || user.nome.trim().length < 3) newErrors.nome = "Nome é obrigatório (mín. 3 caracteres).";
    if (!user.email || !/^\S+@\S+\.\S+$/.test(user.email)) newErrors.email = "Informe um e-mail válido.";
    if (!user.id && (!user.password || user.password.length < 6)) newErrors.senha = "Senha é obrigatória (mín. 6 caracteres).";
    else if (user.id && user.password && user.password.length < 6) newErrors.senha = "A nova senha deve ter no mínimo 6 caracteres.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) onSave(user);
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={["Usuários", user.nome || "Novo Usuário"]} onBack={onCancel} />
      <section className="card max-w-3xl">
        <h1 className="page-title mb-5">{user.id ? "Editar Usuário" : "Novo Usuário"}</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome Completo" value={user.nome} onChange={(v) => { update({ nome: v }); setErrors({ ...errors, nome: "" }); }} error={errors.nome} />
          <Field label="E-mail" value={user.email} onChange={(v) => { update({ email: v }); setErrors({ ...errors, email: "" }); }} error={errors.email} />
          <Field label={user.id ? "Nova Senha (opcional)" : "Senha"} value={user.password || ""} onChange={(v) => { update({ password: v }); setErrors({ ...errors, password: "" }); }} type="password" error={errors.senha} />
          <Select label="Perfil" value={user.role} onChange={(v) => { const role = v as Role; update({ role, vinculos: role === "Manager" ? vinculos : [user.vinculos[0] || vinculos[0] || ""] }); }} options={["Manager", "Funcionário"]} />
          {user.role === "Manager" ? (
             <div className="flex flex-col justify-center rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-primary"><span className="font-semibold">Acesso Total</span><span>Gerentes têm vínculo automático com todas as seguradoras.</span></div>
          ) : (
             <Select label="Vínculo" value={user.vinculos[0] || ""} onChange={(v) => update({ vinculos: [v] })} options={vinculos} />
          )}
          <label className="flex items-center gap-3 rounded-lg border border-borderSoft p-3"><input type="checkbox" checked={user.status === "Ativo"} onChange={(e) => update({ status: e.target.checked ? "Ativo" : "Inativo" })} /><span className="text-sm font-medium">Status Ativo</span></label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" onClick={handleSubmit}>Salvar Usuário</button>
        </div>
      </section>
    </div>
  );
}