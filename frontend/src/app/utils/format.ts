export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export function latestVehiclePlate(observacao?: string | null) {
  let atual: string | null = null;
  let anterior: string | null = null;
  const blocos = String(observacao ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\|[ \t]+(?=Seguro (?:Auto|anterior)\b)/gi, "\n\n")
    .split(/\n[ \t]*\n/);
  for (const bloco of blocos) {
    const placas = [...bloco.matchAll(/\bplaca(?:\s+do\s+ve[ií]culo)?\s*(?:[:=–—-]\s*)?([a-z]{3}[-\s]?[a-z0-9]{4})\b/gi)];
    if (!placas.length) continue;
    const placa = placas[placas.length - 1][1].replace(/[-\s]/g, "").toUpperCase();
    if (!/\d/.test(placa)) continue;
    if (/^\s*Seguro anterior\b/i.test(bloco)) anterior = placa;
    else atual = placa;
  }
  return atual ?? anterior;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

export function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
export function maskCPF(value: string) {
  if (!value) return "";
  return value
    .replace(/\D/g, "") 
    .replace(/(\d{3})(\d)/, "$1.$2") 
    .replace(/(\d{3})(\d)/, "$1.$2") 
    .replace(/(\d{3})(\d{1,2})/, "$1-$2") 
    .substring(0, 14); 
}

export function maskPhone(value: string) {
  if (!value) return "";
  let v = value.replace(/\D/g, ""); 
  v = v.replace(/(\d{2})(\d)/, "($1) $2"); 
  v = v.replace(/(\d)(\d{4})$/, "$1-$2"); 
  return v.substring(0, 15); 
}

export function maskCEP(value: string) {
  if (!value) return "";
  return value
    .replace(/\D/g, "") 
    .replace(/(\d{5})(\d)/, "$1-$2") 
    .substring(0, 9); 
}
