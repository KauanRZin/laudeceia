import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  Edit,
  Eye,
  Lock,
  LogOut,
  Menu,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import type { Client, Insurance, Role, Screen, User } from "./types/domain";
import { ACTIVE_RENEWALS, CLIENTS, EXPIRING_RENEWALS, INSURANCE_TYPES, USERS, VINCULOS } from "./data/mockData";
import { formatDate, initials } from "./utils/format";
import * as authApi from "./api/authApi";
import { normalizeApiError, TOKEN_KEY } from "./api/http";

const blankClient: Client = {
  id: "",
  nome: "",
  cpf: "",
  telefone: "",
  nascimento: "",
  observacao: "",
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" },
  vinculos: ["Agência 1"],
  seguros: [],
};

const blankInsurance: Insurance = {
  id: "",
  tipoId: 1,
  tipoNome: "Seguro de Vida",
  inicioVigencia: "",
  fimVigencia: null,
  vinculoId: 3,
  vinculoNome: "Agência 1",
};

const blankUser: User = {
  id: "",
  nome: "",
  email: "",
  role: "Funcionário",
  vinculos: ["Agência 1"],
  status: "Ativo",
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [clients, setClients] = useState<Client[]>(CLIENTS);
  const [users, setUsers] = useState<User[]>(USERS);
  const [selectedClient, setSelectedClient] = useState<Client>(CLIENTS[0]);
  const [editingClient, setEditingClient] = useState<Client>(CLIENTS[0]);
  const [editingUser, setEditingUser] = useState<User>(USERS[1]);
  const [insuranceModal, setInsuranceModal] = useState(false);
  const [toast, setToast] = useState("");

  const role = currentUser?.role || "Manager";
  const isManager = role === "Manager";
  const ownVinculo = currentUser?.vinculos[0] || "Agência 1";
  const visibleClients = useMemo(() => {
    if (!currentUser || currentUser.role === "Manager") return clients;
    return clients.filter((client) => client.vinculos.includes(ownVinculo));
  }, [clients, currentUser, ownVinculo]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  }

  async function handleLogin(email: string, password: string, selectedRole: Role) {
    try {
      const response = await authApi.login(email, password);
      setCurrentUser(response.user);
      setScreen("dashboard");
    } catch (error) {
      const apiError = normalizeApiError(error);
      const fallback = USERS.find((user) => user.email === email && user.role === selectedRole);
      if (fallback && password === "123456") {
        localStorage.setItem(TOKEN_KEY, "prototype-token");
        setCurrentUser(fallback);
        setScreen("dashboard");
        notify("Usando modo protótipo com dados locais.");
        return;
      }
      notify(apiError.message);
    }
  }

  function logout() {
    authApi.logout();
    setCurrentUser(null);
    setScreen("login");
  }

  function openClientForm(client?: Client) {
    setEditingClient(client ? structuredClone(client) : { ...blankClient, vinculos: [ownVinculo] });
    setScreen("clientForm");
  }

  function openClientProfile(client: Client) {
    setSelectedClient(client);
    setScreen("clientProfile");
  }

  function saveClient(client: Client) {
    const nextClient = { ...client, id: client.id || `c${Date.now()}` };
    setClients((prev) => (client.id ? prev.map((item) => (item.id === client.id ? nextClient : item)) : [nextClient, ...prev]));
    setSelectedClient(nextClient);
    setScreen("clientProfile");
    notify("Cliente salvo com sucesso.");
  }

  function removeClient(id: string) {
    setClients((prev) => prev.filter((client) => client.id !== id));
    notify("Cliente removido.");
  }

  function openUserForm(user?: User) {
    setEditingUser(user ? structuredClone(user) : blankUser);
    setScreen("userForm");
  }

  function saveUser(user: User) {
    const nextUser = { ...user, id: user.id || `u${Date.now()}` };
    setUsers((prev) => (user.id ? prev.map((item) => (item.id === user.id ? nextUser : item)) : [nextUser, ...prev]));
    setScreen("users");
    notify("Usuário salvo com sucesso.");
  }

  function toggleUserStatus(user: User) {
    if (user.role === "SuperAdmin") return;
    setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, status: item.status === "Ativo" ? "Inativo" : "Ativo" } : item)));
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} toast={toast} />;
  }

  return (
    <div className="min-h-screen bg-appBg text-textPrimary">
      <Navbar user={currentUser} screen={screen} setScreen={setScreen} logout={logout} />
      {toast && <div className="fixed right-5 top-20 z-50 rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-card">{toast}</div>}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {screen === "dashboard" && <Dashboard user={currentUser} clients={visibleClients} onRenew={() => openClientForm(CLIENTS[0])} />}
        {screen === "clients" && (
          <ClientList user={currentUser} clients={visibleClients} onNew={() => openClientForm()} onEdit={openClientForm} onView={openClientProfile} onDelete={removeClient} />
        )}
        {screen === "clientForm" && (
          <ClientForm user={currentUser} client={editingClient} setClient={setEditingClient} onCancel={() => setScreen("clients")} onSave={saveClient} onAddInsurance={() => setInsuranceModal(true)} />
        )}
        {screen === "clientProfile" && <ClientProfile user={currentUser} client={selectedClient} onBack={() => setScreen("clients")} onEdit={() => openClientForm(selectedClient)} />}
        {screen === "users" && isManager && <UserManagement users={users} onNew={() => openUserForm()} onEdit={openUserForm} onToggle={toggleUserStatus} />}
        {screen === "userForm" && isManager && <UserForm user={editingUser} setUser={setEditingUser} onCancel={() => setScreen("users")} onSave={saveUser} />}
        {screen === "profile" && <OwnProfile user={currentUser} setUser={setCurrentUser} notify={notify} />}
      </main>
      {insuranceModal && (
        <InsuranceModal
          user={currentUser}
          client={editingClient}
          onClose={() => setInsuranceModal(false)}
          onSave={(insurance) => {
            setEditingClient((client) => ({ ...client, seguros: [...client.seguros, { ...insurance, id: `s${Date.now()}` }] }));
            setInsuranceModal(false);
          }}
        />
      )}
    </div>
  );
}

function LoginScreen({ onLogin, toast }: { onLogin: (email: string, password: string, role: Role) => void; toast: string }) {
  const [email, setEmail] = useState("gerente@seguradora.com");
  const [password, setPassword] = useState("123456");
  const [role, setRole] = useState<Role>("Manager");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1F3A] px-4">
      {toast && <div className="fixed right-5 top-5 rounded-lg bg-white px-4 py-3 text-sm font-medium text-textPrimary shadow-card">{toast}</div>}
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white">
            <ShieldCheck size={30} />
          </div>
          <h1 className="text-2xl font-semibold">SeguraPro</h1>
          <p className="mt-2 text-sm text-textSecondary">Sistema interno de cadastro de clientes</p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onLogin(email, password, role);
          }}
        >
          <Field label="E-mail" value={email} onChange={setEmail} />
          <Field label="Senha" value={password} onChange={setPassword} type="password" />
          <label className="block">
            <span className="label">Perfil do protótipo</span>
            <select className="input" value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option>Manager</option>
              <option>Funcionário</option>
            </select>
          </label>
          <button className="btn-primary w-full" type="submit">Entrar</button>
        </form>
        <div className="mt-6 rounded-lg border border-borderSoft bg-slate-50 p-4 text-xs leading-6 text-textSecondary">
          <p>Gerente: gerente@seguradora.com | senha: 123456</p>
          <p>Funcionário: ana@seguradora.com | senha: 123456</p>
        </div>
      </section>
    </div>
  );
}

function Navbar({ user, screen, setScreen, logout }: { user: User; screen: Screen; setScreen: (screen: Screen) => void; logout: () => void }) {
  const [open, setOpen] = useState(false);
  const color = user.role === "Manager" ? "bg-primary" : "bg-employee";
  return (
    <header className={`${color} sticky top-0 z-40 text-white shadow-card`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <button className="flex items-center gap-3 font-semibold" onClick={() => setScreen("dashboard")}>
          <ShieldCheck />
          <span>SeguraPro</span>
        </button>
        <nav className="hidden items-center gap-2 md:flex">
          <NavButton active={screen === "dashboard"} onClick={() => setScreen("dashboard")}>Dashboard</NavButton>
          <NavButton active={screen === "clients"} onClick={() => setScreen("clients")}>Clientes</NavButton>
          {user.role === "Manager" && <NavButton active={screen === "users"} onClick={() => setScreen("users")}>Usuários</NavButton>}
        </nav>
        <div className="relative flex items-center gap-3">
          <button className="md:hidden" onClick={() => setOpen((value) => !value)}><Menu /></button>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/10" onClick={() => setOpen((value) => !value)}>
            <Avatar name={user.nome} small />
            <span className="hidden text-sm sm:inline">{user.nome} ({user.role === "Manager" ? "Gerente" : "Funcionário"})</span>
          </button>
          {open && (
            <div className="absolute right-0 top-12 w-56 rounded-lg bg-white p-2 text-textPrimary shadow-xl">
              <button className="menu-item md:hidden" onClick={() => setScreen("dashboard")}>Dashboard</button>
              <button className="menu-item md:hidden" onClick={() => setScreen("clients")}>Clientes</button>
              {user.role === "Manager" && <button className="menu-item md:hidden" onClick={() => setScreen("users")}>Usuários</button>}
              <button className="menu-item" onClick={() => setScreen("profile")}><UserCircle size={16} /> Meu Perfil</button>
              <button className="menu-item text-danger" onClick={logout}><LogOut size={16} /> Sair</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Dashboard({ user, clients, onRenew }: { user: User; clients: Client[]; onRenew: () => void }) {
  const active = user.role === "Manager" ? ACTIVE_RENEWALS : ACTIVE_RENEWALS.filter((row) => row.vinculo === user.vinculos[0]);
  const expiring = user.role === "Manager" ? EXPIRING_RENEWALS : EXPIRING_RENEWALS.filter((row) => row.vinculo === user.vinculos[0]);
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-textSecondary">Visão operacional de clientes, seguros e renovações.</p>
        </div>
        {user.role === "Funcionário" && <Banner>Exibindo seguros do seu vínculo: {user.vinculos[0]}</Banner>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard icon={<Users />} label="Total de Clientes" value={clients.length || 47} />
        <MetricCard icon={<CheckCircle2 />} label="Seguros Ativos" value={clients.reduce((sum, client) => sum + client.seguros.length, 0) || 89} />
      </div>
      <section className="card">
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="section-title">Seguros próximos do vencimento</h2>
            <p className="text-sm text-textSecondary">Período padrão: mês atual até quatro meses à frente.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <CalendarDays size={18} className="text-primary" />
            <input className="input w-40" type="date" defaultValue="2025-01-01" />
            <span className="text-textSecondary">até</span>
            <input className="input w-40" type="date" defaultValue="2025-05-01" />
          </div>
        </div>
        <RenewalTable title="Ativos no período" rows={active} mode="active" />
        <div className="mt-8">
          <RenewalTable title="Expirando no período" rows={expiring} mode="expiring" onRenew={onRenew} />
        </div>
      </section>
    </div>
  );
}

function ClientList({ user, clients, onNew, onEdit, onView, onDelete }: { user: User; clients: Client[]; onNew: () => void; onEdit: (client: Client) => void; onView: (client: Client) => void; onDelete: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [vinculo, setVinculo] = useState("Todos");
  const filtered = clients.filter((client) => {
    const bySearch = client.nome.toLowerCase().includes(search.toLowerCase()) || client.cpf.includes(search);
    const byVinculo = vinculo === "Todos" || client.vinculos.includes(vinculo);
    return bySearch && byVinculo;
  });
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="page-title">Clientes Cadastrados</h1>
          {user.role === "Funcionário" && <Banner>Exibindo clientes do seu vínculo: {user.vinculos[0]}</Banner>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-outline"><Upload size={16} /> Importar Dados</button>
          <button className="btn-outline"><Download size={16} /> Exportar Dados</button>
          <button className="btn-primary" onClick={onNew}><Plus size={16} /> Novo Cliente</button>
        </div>
      </div>
      <section className="card">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-textSecondary" size={18} />
            <input className="input pl-10" placeholder="Buscar por nome ou CPF" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          {user.role === "Manager" && (
            <select className="input" value={vinculo} onChange={(event) => setVinculo(event.target.value)}>
              <option>Todos</option>
              {VINCULOS.map((item) => <option key={item}>{item}</option>)}
            </select>
          )}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Vínculos</th><th>Nº de Seguros</th><th>Ações</th></tr></thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id}>
                  <td className="font-medium">{client.nome}</td>
                  <td>{client.cpf}</td>
                  <td>{client.telefone}</td>
                  <td><Pills values={client.vinculos} /></td>
                  <td>{client.seguros.length}</td>
                  <td>
                    <div className="flex gap-1">
                      <IconButton label="Visualizar" onClick={() => onView(client)}><Eye size={17} /></IconButton>
                      <IconButton label="Editar" onClick={() => onEdit(client)}><Edit size={17} /></IconButton>
                      {user.role === "Manager" && <IconButton label="Excluir" danger onClick={() => onDelete(client.id)}><Trash2 size={17} /></IconButton>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ClientForm({ user, client, setClient, onCancel, onSave, onAddInsurance }: { user: User; client: Client; setClient: (client: Client | ((client: Client) => Client)) => void; onCancel: () => void; onSave: (client: Client) => void; onAddInsurance: () => void }) {
  const isManager = user.role === "Manager";
  const update = (patch: Partial<Client>) => setClient((current) => ({ ...current, ...patch }));
  const updateAddress = (key: keyof Client["endereco"], value: string) => setClient((current) => ({ ...current, endereco: { ...current.endereco, [key]: value } }));
  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <Breadcrumb items={["Clientes", client.nome || "Novo Cliente", client.id ? "Editar" : "Novo"]} onBack={onCancel} />
      <section className="card">
        <h1 className="page-title mb-5">{client.id ? "Editar Cliente" : "Novo Cliente"}</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome Completo" value={client.nome} onChange={(value) => update({ nome: value })} />
          <Field label="CPF" value={client.cpf} onChange={(value) => update({ cpf: value })} placeholder="000.000.000-00" />
          <Field label="Data de Nascimento" type="date" value={client.nascimento} onChange={(value) => update({ nascimento: value })} />
          <Field label="Telefone" value={client.telefone} onChange={(value) => update({ telefone: value })} placeholder="(00) 00000-0000" />
          <label className="block md:col-span-2">
            <span className="label">Observação</span>
            <textarea className="input min-h-24" value={client.observacao} onChange={(event) => update({ observacao: event.target.value })} />
          </label>
        </div>
      </section>
      <section className="card">
        <h2 className="section-title mb-4">Endereço</h2>
        <div className="grid gap-4 md:grid-cols-6">
          <Field label="CEP" value={client.endereco.cep} onChange={(value) => updateAddress("cep", value)} className="md:col-span-1" />
          <Field label="Logradouro" value={client.endereco.logradouro} onChange={(value) => updateAddress("logradouro", value)} className="md:col-span-3" />
          <Field label="Número" value={client.endereco.numero} onChange={(value) => updateAddress("numero", value)} className="md:col-span-2" />
          <Field label="Complemento" value={client.endereco.complemento} onChange={(value) => updateAddress("complemento", value)} className="md:col-span-2" />
          <Field label="Bairro" value={client.endereco.bairro} onChange={(value) => updateAddress("bairro", value)} className="md:col-span-2" />
          <Field label="Cidade" value={client.endereco.cidade} onChange={(value) => updateAddress("cidade", value)} className="md:col-span-1" />
          <Field label="Estado" value={client.endereco.estado} onChange={(value) => updateAddress("estado", value)} className="md:col-span-1" />
        </div>
      </section>
      <section className="card">
        <h2 className="section-title mb-4">Vínculos do Cliente</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Vínculo primário" value={client.vinculos[0] || user.vinculos[0]} disabled={!isManager} onChange={(value) => update({ vinculos: [value, ...client.vinculos.slice(1)] })} options={VINCULOS} />
          {isManager && client.vinculos.length > 1 && <Select label="Vínculo secundário" value={client.vinculos[1]} onChange={(value) => update({ vinculos: [client.vinculos[0], value] })} options={VINCULOS} />}
        </div>
        {isManager && client.vinculos.length < 2 && <button className="mt-4 text-sm font-semibold text-primary" onClick={() => update({ vinculos: [client.vinculos[0] || VINCULOS[0], VINCULOS[1]] })}>+ Adicionar segundo vínculo</button>}
        {isManager && <p className="mt-2 text-xs text-textSecondary">Apenas gerentes podem adicionar um segundo vínculo.</p>}
      </section>
      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Seguros Vinculados</h2>
          <button className="btn-primary" onClick={onAddInsurance}><Plus size={16} /> Adicionar Seguro</button>
        </div>
        <InsuranceCards user={user} insurances={client.seguros} />
      </section>
      <ActionBar>
        <button className="btn-outline" onClick={onCancel}>Cancelar</button>
        <button className="btn-primary" onClick={() => onSave(client)}><Save size={16} /> Salvar Cliente</button>
      </ActionBar>
    </div>
  );
}

function ClientProfile({ user, client, onBack, onEdit }: { user: User; client: Client; onBack: () => void; onEdit: () => void }) {
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
          <InsuranceCards user={user} insurances={client.seguros} editable />
        </div>
      </section>
    </div>
  );
}

function InsuranceModal({ user, client, onClose, onSave }: { user: User; client: Client; onClose: () => void; onSave: (insurance: Insurance) => void }) {
  const [insurance, setInsurance] = useState<Insurance>({ ...blankInsurance, vinculoNome: user.role === "Funcionário" ? user.vinculos[0] : client.vinculos[0] || VINCULOS[0] });
  const selectedType = INSURANCE_TYPES.find((type) => type.id === insurance.tipoId)!;
  const isLife = insurance.tipoId === 1;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
      <section className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-title">Adicionar Seguro</h2>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <Select label="Tipo de Seguro" value={String(insurance.tipoId)} onChange={(value) => setInsurance({ ...insurance, tipoId: Number(value), tipoNome: INSURANCE_TYPES.find((type) => type.id === Number(value))!.nome, fimVigencia: Number(value) === 1 ? null : insurance.fimVigencia })} options={INSURANCE_TYPES.map((type) => ({ label: `${type.id} - ${type.nome}`, value: String(type.id) }))} />
          <Field label="Início de Vigência" type="date" value={insurance.inicioVigencia} onChange={(value) => setInsurance({ ...insurance, inicioVigencia: value })} />
          {isLife ? <p className="rounded-lg bg-blue-50 p-3 text-sm text-primary">Seguro de Vida não possui fim de vigência.</p> : <Field label="Fim de Vigência" type="date" value={insurance.fimVigencia || ""} onChange={(value) => setInsurance({ ...insurance, fimVigencia: value })} />}
          <Select label="Vínculo" value={insurance.vinculoNome} disabled={user.role === "Funcionário"} onChange={(value) => setInsurance({ ...insurance, vinculoNome: value, vinculoId: VINCULOS.indexOf(value) + 1 })} options={user.role === "Manager" ? VINCULOS : user.vinculos} />
          {user.role === "Funcionário" && <p className="text-xs text-textSecondary">Seguros só podem ser vinculados à sua agência: {user.vinculos[0]}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => onSave({ ...insurance, tipoNome: selectedType.nome, fimVigencia: isLife ? null : insurance.fimVigencia })}>Salvar Seguro</button>
        </div>
      </section>
    </div>
  );
}

function UserManagement({ users, onNew, onEdit, onToggle }: { users: User[]; onNew: () => void; onEdit: (user: User) => void; onToggle: (user: User) => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Usuários do Sistema</h1>
        <button className="btn-primary" onClick={onNew}><Plus size={16} /> Novo Usuário</button>
      </div>
      <section className="card table-wrap">
        <table className="data-table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Vínculo</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {users.map((user) => {
              const locked = user.role === "SuperAdmin";
              return (
                <tr key={user.id} className={locked ? "bg-slate-50 text-inactive" : ""} title={locked ? "Usuário de sistema — não editável" : ""}>
                  <td className="font-medium">{locked && <Lock className="mr-2 inline" size={15} />}{user.nome}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.vinculos.length ? user.vinculos.join(", ") : "—"}</td>
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
      </section>
    </div>
  );
}

function UserForm({ user, setUser, onCancel, onSave }: { user: User; setUser: (user: User | ((user: User) => User)) => void; onCancel: () => void; onSave: (user: User) => void }) {
  const update = (patch: Partial<User>) => setUser((current) => ({ ...current, ...patch }));
  return (
    <div className="space-y-5">
      <Breadcrumb items={["Usuários", user.nome || "Novo Usuário"]} onBack={onCancel} />
      <section className="card max-w-3xl">
        <h1 className="page-title mb-5">{user.id ? "Editar Usuário" : "Novo Usuário"}</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome Completo" value={user.nome} onChange={(value) => update({ nome: value })} />
          <Field label="E-mail" value={user.email} onChange={(value) => update({ email: value })} />
          <Select label="Perfil" value={user.role} onChange={(value) => update({ role: value as Role, vinculos: value === "Manager" ? user.vinculos : [user.vinculos[0] || "Agência 1"] })} options={["Manager", "Funcionário"]} />
          <Select label="Vínculo" value={user.vinculos[0] || ""} onChange={(value) => update({ vinculos: [value] })} options={VINCULOS} />
          <label className="flex items-center gap-3 rounded-lg border border-borderSoft p-3">
            <input type="checkbox" checked={user.status === "Ativo"} onChange={(event) => update({ status: event.target.checked ? "Ativo" : "Inativo" })} />
            <span className="text-sm font-medium">Status Ativo</span>
          </label>
          <p className="text-sm text-textSecondary">Funcionários devem ter apenas 1 vínculo. Gerentes podem ter múltiplos.</p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" onClick={() => onSave(user)}>Salvar Usuário</button>
        </div>
      </section>
    </div>
  );
}

function OwnProfile({ user, setUser, notify }: { user: User; setUser: (user: User) => void; notify: (message: string) => void }) {
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

function RenewalTable({ title, rows, mode, onRenew }: { title: string; rows: typeof ACTIVE_RENEWALS; mode: "active" | "expiring"; onRenew?: () => void }) {
  return (
    <div>
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>{mode === "active" ? ["Cliente", "Tipo de Seguro", "Vínculo", "Início", "Fim", "Status"].map((h) => <th key={h}>{h}</th>) : ["Cliente", "Tipo de Seguro", "Vínculo", "Fim", "Dias restantes", "Ação"].map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.cliente}-${row.tipo}`}>
                <td className="font-medium">{row.cliente}</td>
                <td>{row.tipo}</td>
                <td>{row.vinculo}</td>
                {mode === "active" && <td>{formatDate(row.inicio)}</td>}
                <td>{row.fim ? formatDate(row.fim) : row.tipo === "Seguro de Vida" ? "Sem vencimento" : "—"}</td>
                {mode === "active" ? <td><StatusBadge status="Ativo" /></td> : <td>{row.dias} dias</td>}
                {mode === "expiring" && <td><button className="btn-primary btn-small" onClick={onRenew}>Renovar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InsuranceCards({ user, insurances, editable }: { user: User; insurances: Insurance[]; editable?: boolean }) {
  if (!insurances.length) return <p className="rounded-lg border border-dashed border-borderSoft p-5 text-sm text-textSecondary">Nenhum seguro vinculado.</p>;
  return (
    <div className="grid gap-3">
      {insurances.map((insurance) => (
        <article key={insurance.id} className="rounded-lg border border-borderSoft p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-semibold">{insurance.tipoNome}</h3>
              <p className="text-sm text-textSecondary">Vigência: {formatDate(insurance.inicioVigencia)} → {insurance.tipoId === 1 ? "Sem vencimento" : formatDate(insurance.fimVigencia)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{insurance.vinculoNome}</Badge>
              {editable && <IconButton label="Editar"><Edit size={16} /></IconButton>}
              {editable && user.role === "Manager" && <IconButton label="Remover" danger><Trash2 size={16} /></IconButton>}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      <input className="input" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: Array<string | { label: string; value: string }>; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const item = typeof option === "string" ? { label: option, value: option } : option;
          return <option key={item.value} value={item.value}>{item.label}</option>;
        })}
      </select>
    </label>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <section className="card flex items-center gap-4"><div className="metric-icon">{icon}</div><div><p className="text-sm text-textSecondary">{label}</p><p className="text-3xl font-semibold">{value}</p></div></section>;
}

function Breadcrumb({ items, onBack }: { items: string[]; onBack: () => void }) {
  return <div className="flex items-center gap-2 text-sm text-textSecondary"><button className="icon-button" onClick={onBack}><ArrowLeft size={18} /></button>{items.map((item, index) => <span key={item} className={index === items.length - 1 ? "font-medium text-textPrimary" : ""}>{item}{index < items.length - 1 && <span className="mx-2 text-textSecondary">&gt;</span>}</span>)}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="mb-4"><span className="label">{label}</span><p className="mt-1 text-sm leading-6">{value}</p></div>;
}

function Avatar({ name, small }: { name: string; small?: boolean }) {
  return <div className={`${small ? "h-8 w-8 text-xs" : "h-16 w-16 text-lg"} flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-primary`}>{initials(name)}</div>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">{children}</span>;
}

function Pills({ values }: { values: string[] }) {
  return <div className="flex flex-wrap gap-1.5">{values.map((value) => <Badge key={value}>{value}</Badge>)}</div>;
}

function StatusBadge({ status }: { status: "Ativo" | "Inativo" | "Expirando" | "Expirado" }) {
  const styles = status === "Ativo" ? "bg-green-50 text-success" : status === "Expirando" ? "bg-amber-50 text-warning" : status === "Expirado" ? "bg-red-50 text-danger" : "bg-slate-100 text-inactive";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>{status}</span>;
}

function IconButton({ children, label, onClick, danger, disabled }: { children: React.ReactNode; label: string; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return <button className={`icon-button ${danger ? "text-danger" : ""}`} title={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

function NavButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return <button className={`rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-white/20" : "hover:bg-white/10"}`} onClick={onClick}>{children}</button>;
}

function Banner({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-primary">{children}</div>;
}

function ActionBar({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-x-0 bottom-0 z-30 flex justify-end gap-2 border-t border-borderSoft bg-white p-4 md:static md:border-0 md:bg-transparent md:p-0">{children}</div>;
}
