import React from "react";
import { ArrowLeft } from "lucide-react";
import { initials } from "../utils/format";

export function Field({ label, value, onChange, type = "text", placeholder, className = "", error }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; className?: string; error?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      <input className={`input ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {error && <span className="mt-1 block text-xs font-medium text-red-500">{error}</span>}
    </label>
  );
}

export function Select({ label, value, onChange, options, disabled, error }: { label: string; value: string; onChange: (value: string) => void; options: Array<string | { label: string; value: string }>; disabled?: boolean; error?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className={`input ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const item = typeof option === "string" ? { label: option, value: option } : option;
          return <option key={item.value} value={item.value}>{item.label}</option>;
        })}
      </select>
      {error && <span className="mt-1 block text-xs font-medium text-red-500">{error}</span>}
    </label>
  );
}

export function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <section className="card flex items-center gap-4"><div className="metric-icon">{icon}</div><div><p className="text-sm text-textSecondary">{label}</p><p className="text-3xl font-semibold">{value}</p></div></section>;
}

export function Breadcrumb({ items, onBack }: { items: string[]; onBack: () => void }) {
  return <div className="flex items-center gap-2 text-sm text-textSecondary"><button className="icon-button" onClick={onBack}><ArrowLeft size={18} /></button>{items.map((item, index) => <span key={item} className={index === items.length - 1 ? "font-medium text-textPrimary" : ""}>{item}{index < items.length - 1 && <span className="mx-2 text-textSecondary">&gt;</span>}</span>)}</div>;
}

export function Detail({ label, value }: { label: string; value: string }) {
  return <div className="mb-4"><span className="label">{label}</span><p className="mt-1 text-sm leading-6">{value}</p></div>;
}

export function Avatar({ name, small }: { name: string; small?: boolean }) {
  return <div className={`${small ? "h-8 w-8 text-xs" : "h-16 w-16 text-lg"} flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-primary`}>{initials(name)}</div>;
}

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">{children}</span>;
}

export function Pills({ values }: { values: string[] }) {
  return <div className="flex flex-wrap gap-1.5">{values.map((value) => <Badge key={value}>{value}</Badge>)}</div>;
}

export function StatusBadge({ status }: { status: "Ativo" | "Inativo" | "Expirando" | "Expirado" }) {
  const styles = status === "Ativo" ? "bg-green-50 text-success" : status === "Expirando" ? "bg-amber-50 text-warning" : status === "Expirado" ? "bg-red-50 text-danger" : "bg-slate-100 text-inactive";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>{status}</span>;
}

export function IconButton({ children, label, onClick, danger, disabled }: { children: React.ReactNode; label: string; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return <button type="button" className={`icon-button ${danger ? "text-danger" : ""}`} title={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

export function NavButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return <button className={`rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-white/20" : "hover:bg-white/10"}`} onClick={onClick}>{children}</button>;
}

export function Banner({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-primary">{children}</div>;
}

export function ActionBar({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-x-0 bottom-0 z-30 flex justify-end gap-2 border-t border-borderSoft bg-white p-4 md:static md:border-0 md:bg-transparent md:p-0">{children}</div>;
}