const express = require("express");
const controller = require("./clients.controller");
const auth = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const asyncHandler = require("../../utils/asyncHandler");
const {
  createClientSchema,
  updateClientSchema,
  clientIdSchema,
  createInsuranceSchema,
  updateInsuranceSchema,
} = require("./clients.schema");

const router = express.Router();
router.use(auth);

/**
 * @openapi
 * /clients:
 *   get:
 *     summary: Lista clientes visíveis para o usuário
 *     responses:
 *       200:
 *         description: Lista de clientes
 *   post:
 *     summary: Cria cliente
 *     responses:
 *       201:
 *         description: Cliente criado
 */
router.get("/", asyncHandler(controller.list));
router.post("/", validate(createClientSchema), asyncHandler(controller.create));

/**
 * @openapi
 * /clients/{id}:
 *   get:
 *     summary: Busca cliente por ID
 *   put:
 *     summary: Atualiza cliente
 *   delete:
 *     summary: Exclui cliente
 */
router.get("/:id", validate(clientIdSchema), asyncHandler(controller.getById));
router.patch("/:id", validate(updateClientSchema), asyncHandler(controller.update));
router.delete("/:id", validate(clientIdSchema), asyncHandler(controller.remove));

/**
 * @openapi
 * /clients/{id}/insurances:
 *   post:
 *     summary: Adiciona seguro ao cliente
 */
router.post("/:id/insurances", validate(createInsuranceSchema), asyncHandler(controller.addInsurance));

/**
 * @openapi
 * /clients/{id}/insurances/{insuranceId}:
 *   put:
 *     summary: Atualiza seguro do cliente
 *   delete:
 *     summary: Remove seguro do cliente
 */
router.patch("/:id/insurances/:insuranceId", validate(updateInsuranceSchema), asyncHandler(controller.updateInsurance));
router.delete("/:id/insurances/:insuranceId", asyncHandler(controller.removeInsurance));

module.exports = router;
