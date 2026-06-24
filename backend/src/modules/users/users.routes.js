const express = require("express");
const controller = require("./users.controller");
const auth = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const asyncHandler = require("../../utils/asyncHandler");
const {
  createUserSchema,
  updateUserSchema,
  statusSchemaBody,
  userIdSchema,
  ownProfileSchema,
} = require("./users.schema");

const router = express.Router();
router.use(auth);

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Lista usuários
 *   post:
 *     summary: Cria usuário
 */
router.get("/", asyncHandler(controller.list));
router.post("/", validate(createUserSchema), asyncHandler(controller.create));

/**
 * @openapi
 * /users/me:
 *   put:
 *     summary: Atualiza o próprio perfil
 */
router.put("/me", validate(ownProfileSchema), asyncHandler(controller.updateMe));

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Busca usuário por ID
 *   put:
 *     summary: Atualiza usuário
 */
router.get("/:id", validate(userIdSchema), asyncHandler(controller.getById));
router.put("/:id", validate(updateUserSchema), asyncHandler(controller.update));

/**
 * @openapi
 * /users/{id}/status:
 *   patch:
 *     summary: Ativa ou inativa usuário
 */
router.patch("/:id/status", validate(statusSchemaBody), asyncHandler(controller.updateStatus));

module.exports = router;
