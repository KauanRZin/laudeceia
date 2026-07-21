import { useState } from "react";
import { ShieldCheck, Menu, UserCircle, LogOut } from "lucide-react";
import type { Screen, User } from "../types/domain";
import { Avatar, NavButton } from "./SharedUI";

export function Navbar({ user, screen, setScreen, logout }: { user: User; screen: Screen; setScreen: (screen: Screen) => void; logout: () => void }) {
  const [open, setOpen] = useState(false);
  const isStaff = user.role === "Manager" || user.role === "SuperAdmin";
  const color = isStaff ? "bg-primary" : "bg-employee";
  const roleLabel = user.role === "SuperAdmin" ? "Administrador" : user.role === "Manager" ? "Gerente" : "Funcionário";
  
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
          {isStaff && <NavButton active={screen === "users"} onClick={() => setScreen("users")}>Usuários</NavButton>}
        </nav>
        <div className="relative flex items-center gap-3">
          <button className="md:hidden" onClick={() => setOpen((value) => !value)}><Menu /></button>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/10" onClick={() => setOpen((value) => !value)}>
            <Avatar name={user.nome} small />
            <span className="hidden text-sm sm:inline">{user.nome} ({roleLabel})</span>
          </button>
          {open && (
            <div className="absolute right-0 top-12 w-56 rounded-lg bg-white p-2 text-textPrimary shadow-xl">
              <button className="menu-item md:hidden" onClick={() => setScreen("dashboard")}>Dashboard</button>
              <button className="menu-item md:hidden" onClick={() => setScreen("clients")}>Clientes</button>
              {isStaff && <button className="menu-item md:hidden" onClick={() => setScreen("users")}>Usuários</button>}
              <button className="menu-item" onClick={() => setScreen("profile")}><UserCircle size={16} /> Meu Perfil</button>
              <button className="menu-item text-danger" onClick={logout}><LogOut size={16} /> Sair</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}