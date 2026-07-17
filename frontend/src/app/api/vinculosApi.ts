import { api } from "./http";

export interface Vinculo {
  id: number;
  nome: string;
}

export async function getVinculos() {
  const { data } = await api.get<Vinculo[]>("/vinculos");
  return data;
}