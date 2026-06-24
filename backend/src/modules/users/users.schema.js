const { z } = require("zod");

const roleSchema = z.enum(["Manager", "Funcionário", "Funcionario", "Employee", "SuperAdmin"]);
const statusSchema = z.enum(["Ativo", "Inativo"]);

const userBody = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").optional(),
  role: roleSchema,
  vinculos: z.array(z.string()).optional().default([]),
  status: statusSchema.optional(),
  avatar: z.string().optional().nullable(),
});

const idParams = z.object({ id: z.string().uuid("ID inválido") });

const createUserSchema = z.object({
  body: userBody.extend({
    password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  }),
});

const updateUserSchema = z.object({
  params: idParams,
  body: userBody.partial(),
});

const statusSchemaBody = z.object({
  params: idParams,
  body: z.object({ status: statusSchema }),
});

const userIdSchema = z.object({ params: idParams });

const ownProfileSchema = z.object({
  body: z.object({
    nome: z.string().min(2, "Nome obrigatório").optional(),
    avatar: z.string().optional().nullable(),
  }),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  statusSchemaBody,
  userIdSchema,
  ownProfileSchema,
};
