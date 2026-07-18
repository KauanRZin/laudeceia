export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export async function buscarDadosCep(cep: string): Promise<ViaCepResponse | null> {
  // Limpa o CEP tirando hífens e pontos
  const cepLimpo = cep.replace(/\D/g, "");

  // Garante que só vai fazer a requisição se tiver 8 dígitos
  if (cepLimpo.length !== 8) {
    return null;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data: ViaCepResponse = await response.json();

    // A API do ViaCEP retorna { erro: true } se o formato for válido mas o CEP não existir
    if (data.erro) {
      console.warn("CEP não encontrado.");
      return null; 
    }

    return data;
  } catch (error) {
    console.error("Erro ao buscar o CEP:", error);
    return null;
  }
}