import { useState, useEffect, useMemo, useCallback } from "react";
import type { Screen, Client, User } from "./types/domain";
import { getVinculos, type Vinculo } from "./api/vinculosApi";
import { getInsuranceTypes, type InsuranceType } from "./api/insuranceTypesApi";
import { normalizeApiError } from "./api/http";
import * as clientsApi from "./api/clientsApi";

// Hooks
import { useAuth } from "./hooks/useAuth";
import { useClients } from "./hooks/useClient"; // Ajuste o nome da pasta de acordo com seu projeto (useClient ou useClients)
import { useUsers } from "./screens/UserManagement"; 

// Telas e Componentes
import { Navbar } from "./components/Navbar";
import { LoginScreen } from "./screens/LoginScreen";
import { Dashboard } from "./screens/Dashboard";
import { ClientList } from "./screens/ClientList";
import { ClientForm } from "./screens/ClientForm";
import { ClientProfile } from "./screens/ClientProfile";
import { UserManagement, UserForm } from "./screens/UserManagement";
import { OwnProfile } from "./screens/OwnProfile";

// Modais Avulsos do Root
import { InsuranceModal } from "./modals/InsuranceModal";
import { RenewModal } from "./modals/RenewModal";

function makeBlankClient(defaultVinculo: string): Client {
  return { id: "", nome: "", cpf: "", telefone: "", nascimento: "", observacao: "", endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" }, vinculos: defaultVinculo ? [defaultVinculo] : [], seguros: [] };
}
function makeBlankUser(defaultVinculo: string): User {
  return { id: "", nome: "", email: "", password: "", role: "Funcionário", vinculos: defaultVinculo ? [defaultVinculo] : [], status: "Ativo" };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [toast, setToast] = useState("");
  
  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  }, []);

  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [insuranceModal, setInsuranceModal] = useState(false);
  const [renewingRow, setRenewingRow] = useState<any>(null);

  const [rangeStart, setRangeStart] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); });
  const [rangeEnd, setRangeEnd] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); });

  const { currentUser, setCurrentUser, authChecked, login, logout } = useAuth(notify);
  const { visibleClients, loading: clientsLoading, saveClient, removeClient, setClients } = useClients(currentUser, notify);
  const { users, loading: usersLoading, saveUser, toggleUserStatus } = useUsers(currentUser, notify);
  
  const vinculoNomes = useMemo(() => vinculos.map((item) => item.nome), [vinculos]);
  const isManager = currentUser?.role === "Manager" || currentUser?.role === "SuperAdmin";

  useEffect(() => {
    if (currentUser && screen === "login") {
      setScreen("dashboard");
    }
  }, [currentUser, screen]);

  useEffect(() => {
    if (!currentUser) return;
    getVinculos().then(setVinculos).catch((err) => notify(normalizeApiError(err).message));
    getInsuranceTypes().then(setInsuranceTypes).catch((err) => notify(normalizeApiError(err).message));
  }, [currentUser, notify]); 

  async function handleRenew(clientId: string, insuranceId: string, novaData: string) {
    try {
      await clientsApi.updateInsurance(clientId, insuranceId, { fimVigencia: novaData });
      setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, seguros: c.seguros.map((s) => (s.id === insuranceId ? { ...s, fimVigencia: novaData } : s)) } : c));
      notify("Data de renovação atualizada com sucesso!");
      setRenewingRow(null);
    } catch (error) { notify(normalizeApiError(error).message); }
  }

  async function handleLogin(email: string, password: string) {
    await login(email, password);
    setScreen("dashboard");
  }

  if (!authChecked) return <div className="flex min-h-screen items-center justify-center bg-appBg text-textSecondary">Carregando...</div>;
  if (!currentUser) return <LoginScreen onLogin={handleLogin} toast={toast} />;

  return (
    <div className="min-h-screen bg-appBg text-textPrimary">
      <Navbar user={currentUser} screen={screen} setScreen={setScreen} logout={logout} />
      {toast && <div className="fixed right-5 top-20 z-50 rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-card">{toast}</div>}
      
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {screen === "dashboard" && (
          <Dashboard user={currentUser} clients={visibleClients} loading={clientsLoading} rangeStart={rangeStart} rangeEnd={rangeEnd} onRangeStartChange={setRangeStart} onRangeEndChange={setRangeEnd} onRenew={setRenewingRow} />
        )}
        
        {screen === "clients" && (
          <ClientList user={currentUser} clients={visibleClients} vinculos={vinculoNomes} loading={clientsLoading} 
            onNew={() => { setEditingClient(makeBlankClient(currentUser.vinculos[0] || vinculoNomes[0])); setScreen("clientForm"); }}
            onEdit={(client: Client) => { setEditingClient(structuredClone(client)); setScreen("clientForm"); }}
            onView={(client: Client) => { setSelectedClient(client); setScreen("clientProfile"); }}
            onDelete={removeClient}
          />
        )}
        
        {screen === "clientForm" && editingClient && (
          <ClientForm user={currentUser} client={editingClient} vinculos={vinculoNomes} setClient={setEditingClient} onCancel={() => setScreen("clients")} onAddInsurance={() => setInsuranceModal(true)}
            onSave={async (client: Client) => { const saved = await saveClient(client); setSelectedClient(saved); setScreen("clientProfile"); }}
          />
        )}
        
        {screen === "clientProfile" && selectedClient && (
          <ClientProfile user={currentUser} client={selectedClient} onBack={() => setScreen("clients")} onEdit={() => { setEditingClient(structuredClone(selectedClient)); setScreen("clientForm"); }} />
        )}

        {screen === "users" && isManager && (
          <UserManagement 
            currentUser={currentUser} /* <-- Passando o currentUser para travar a tela */
            users={users} 
            loading={usersLoading} 
            onToggle={toggleUserStatus} 
            onNew={() => { setEditingUser(makeBlankUser(vinculoNomes[0])); setScreen("userForm"); }} 
            onEdit={(u: User) => { setEditingUser(structuredClone(u)); setScreen("userForm"); }} 
          />
        )}

        {screen === "userForm" && isManager && editingUser && (
          <UserForm 
            currentUser={currentUser} /* <-- Passando o currentUser para travar o formulário */
            user={editingUser} 
            vinculos={vinculoNomes} 
            setUser={setEditingUser} 
            onCancel={() => setScreen("users")} 
            onSave={(user: User) => { saveUser(user); setScreen("users"); }} 
          />
        )}

        {screen === "profile" && <OwnProfile user={currentUser} setUser={setCurrentUser} notify={notify} />}
      </main>

      {/* Modais Globais do Root */}
      {insuranceModal && editingClient && (
        <InsuranceModal user={currentUser} client={editingClient} vinculos={vinculos} insuranceTypes={insuranceTypes} onClose={() => setInsuranceModal(false)}
          onSave={(ins) => { setEditingClient((c:any) => c ? { ...c, seguros: [...c.seguros, { ...ins, id: `s${Date.now()}` }] } : c); setInsuranceModal(false); }}
        /> 
      )}
      {renewingRow && <RenewModal row={renewingRow} onClose={() => setRenewingRow(null)} onSave={handleRenew} />}
    </div>
  );
}