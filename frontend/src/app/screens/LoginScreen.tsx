import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Field } from "../components/SharedUI";

export function LoginScreen({ onLogin, toast }: { onLogin: (email: string, password: string) => void; toast: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    
    const newErrors: Record<string, string> = {};

    // 1. Valida se o e-mail está vazio ou inválido
    if (!email.trim()) {
      newErrors.email = "O e-mail é obrigatório.";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = "Digite um formato de e-mail válido.";
    }

    if (!password) {
      newErrors.password = "A senha é obrigatória.";
    } 
    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onLogin(email, password);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1F3A] px-4">
      {toast && (
        <div className="fixed right-5 top-5 rounded-lg bg-white px-4 py-3 text-sm font-medium text-textPrimary shadow-card">
          {toast}
        </div>
      )}
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white">
            <ShieldCheck size={30} />
          </div>
          <h1 className="text-2xl font-semibold">SeguraPro</h1>
          <p className="mt-2 text-sm text-textSecondary">Sistema interno de cadastro de clientes</p>
        </div>
        
        {/* Passamos o nosso handleSubmit para o form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field 
            label="E-mail" 
            value={email} 
            onChange={(val) => { 
              setEmail(val); 
              setErrors({ ...errors, email: "" }); // Limpa o erro ao digitar
            }} 
            error={errors.email}
          />
          
          <Field 
            label="Senha" 
            value={password} 
            onChange={(val) => { 
              setPassword(val); 
              setErrors({ ...errors, password: "" }); // Limpa o erro ao digitar
            }} 
            type="password" 
            error={errors.password}
          />
          
          <button className="btn-primary w-full" type="submit">Entrar</button>
        </form>
      </section>
    </div>
  );
}