import { useState, useEffect, useMemo } from "react";
import type { Client, User } from "../types/domain";
import * as clientsApi from "../api/clientsApi";
import { normalizeApiError } from "../api/http";

export function useClients(currentUser: User | null, notify: (msg: string) => void) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    clientsApi
      .getClients()
      .then(setClients)
      .catch((error) => notify(normalizeApiError(error).message))
      .finally(() => setLoading(false));
  }, [currentUser, notify]);

  const visibleClients = useMemo(() => {
    if (!currentUser || currentUser.role === "Manager" || currentUser.role === "SuperAdmin") return clients;
    const ownVinculo = currentUser.vinculos[0] || "";
    return clients.filter((client) => client.vinculos.includes(ownVinculo));
  }, [clients, currentUser]);

  async function saveClient(client: Client) {
    try {
      const saved = await clientsApi.saveClient(client);
      const novosSeguros = client.seguros.filter((seguro) => String(seguro.id).startsWith("s"));
      const segurosCriados = [];
      
      for (const seguro of novosSeguros) {
        const payload = {
          tipoId: Number(seguro.tipoId),
          vinculoId: Number(seguro.vinculoId),
          inicioVigencia: seguro.inicioVigencia,
          fimVigencia: seguro.fimVigencia || null,
        };
        const criado = await clientsApi.addInsurance(saved.id, payload);
        segurosCriados.push(criado);
      }
      
      const segurosAntigos = client.seguros.filter((seguro) => !String(seguro.id).startsWith("s"));
      saved.seguros = [...segurosAntigos, ...segurosCriados];

      setClients((prev) => (client.id ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev]));
      notify("Cliente salvo com sucesso.");
      return saved;
    } catch (error) {
      const apiError = normalizeApiError(error);
      console.error("Erro ao salvar cliente:", apiError);
      notify(apiError.message);
      throw apiError; 
    }
  }

  async function removeClient(id: string) {
    try {
      await clientsApi.deleteClient(id);
      setClients((prev) => prev.filter((client) => client.id !== id));
      notify("Cliente removido.");
    } catch (error) {
      notify(normalizeApiError(error).message);
    }
  }

  return { clients, visibleClients, loading, saveClient, removeClient, setClients };
}