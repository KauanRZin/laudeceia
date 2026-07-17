import { api } from "./http";

export interface InsuranceType {
  id: number;
  nome: string;
}

export async function getInsuranceTypes() {
  const { data } = await api.get<InsuranceType[]>("/insurance-types");
  return data;
}