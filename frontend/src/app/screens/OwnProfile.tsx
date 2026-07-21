import { useState } from "react";
import type { User } from "../types/domain";
import { Avatar, Field, Detail, Pills } from "../components/SharedUI";

export function OwnProfile({ user, setUser, notify }: { user: User; setUser: (user: User) => void; notify: (message: string) => void }) {
  const [name, setName] = useState(user.nome);
  return (
    <section className="card mx-auto max-w-xl">
      <div className="mb-6 flex flex-col items-center text-center">
        <Avatar name={name} />
        <button className="btn-outline mt-4">Enviar foto</button>
      </div>
      <div className="space-y-4">
        <Field label="Nome Completo" value={name} onChange={setName} />
        <Detail label="E-mail" value={user.email} />
        <Detail label="Perfil" value={user.role} />
        <div><span className="label">Vínculo(s)</span><div className="mt-2"><Pills values={user.vinculos} /></div></div>
        <button className="btn-primary w-full" onClick={() => { setUser({ ...user, nome: name }); notify("Perfil atualizado."); }}>Salvar Alterações</button>
      </div>
    </section>
  );
}