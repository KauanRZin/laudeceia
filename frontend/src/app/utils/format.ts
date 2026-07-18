export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("pt-BR").format(date);
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
