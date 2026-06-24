const { z } = require("zod");

const addressSchema = z.object({
  cep: z.string().min(1, "CEP obrigatório"),
  logradouro: z.string().min(1, "Logradouro obrigatório"),
  numero: z.string().min(1, "Número obrigatório"),
  complemento: z.string().optional().default(""),
  bairro: z.string().min(1, "Bairro obrigatório"),
  cidade: z.string().min(1, "Cidade obrigatória"),
  estado: z.string().min(2, "Estado obrigatório"),
});

const clientBody = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cpf: z.string().min(11, "CPF inválido"),
  telefone: z.string().min(8, "Telefone inválido"),
  nascimento: z.string().min(1, "Nascimento obrigatório"),
  observacao: z.string().optional().default(""),
  endereco: addressSchema,
  vinculos: z.array(z.string()).min(1).max(2).optional(),
  vinculo: z.string().optional(),
});

const idParams = z.object({ id: z.string().uuid("ID inválido") });

const createClientSchema = z.object({ body: clientBody });
const updateClientSchema = z.object({ params: idParams, body: clientBody.partial() });
const clientIdSchema = z.object({ params: idParams });

const insuranceBody = z.object({
  tipoId: z.number().int().positive(),
  inicioVigencia: z.string().min(1, "Início de vigência obrigatório"),
  fimVigencia: z.string().nullable().optional(),
  vinculoId: z.number().int().positive(),
});

const insuranceParams = z.object({
  id: z.string().uuid("ID do cliente inválido"),
  insuranceId: z.string().uuid("ID do seguro inválido"),
});

const createInsuranceSchema = z.object({
  params: idParams,
  body: insuranceBody,
});

const updateInsuranceSchema = z.object({
  params: insuranceParams,
  body: insuranceBody.partial(),
});

module.exports = {
  createClientSchema,
  updateClientSchema,
  clientIdSchema,
  createInsuranceSchema,
  updateInsuranceSchema,
};
