import axios, { AxiosError } from "axios";

export const TOKEN_KEY = "segurapro_token";

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, string>;
  status?: number;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  timeout: 12000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function normalizeApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: ApiError }>;
    const payload = axiosError.response?.data?.error;
    return {
      message: payload?.message || "Não foi possível conectar à API.",
      code: payload?.code || "NETWORK_ERROR",
      details: payload?.details,
      status: axiosError.response?.status,
    };
  }
  return { message: "Erro inesperado.", code: "UNKNOWN_ERROR" };
}
