const express = require("express");
const controller = require("./users.controller");
const auth = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/authorize");
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

router.get("/database-backup", requireRole("SUPERADMIN"), asyncHandler(controller.downloadDatabaseBackup));
router.post("/database-backup", requireRole("SUPERADMIN"),
  express.raw({ type: "application/sql", limit: "20mb", inflate: false }),
  asyncHandler(controller.uploadDatabaseBackup));

/**
 * @openapi
 * /users/me:
 *   put:
 *     summary: Atualiza o próprio perfil
 */
router.patch("/me", validate(ownProfileSchema), asyncHandler(controller.updateMe));

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Busca usuário por ID
 *   put:
 *     summary: Atualiza usuário
 */
router.get("/:id", validate(userIdSchema), asyncHandler(controller.getById));
router.patch("/:id", validate(updateUserSchema), asyncHandler(controller.update));

/**
 * @openapi
 * /users/{id}/status:
 *   patch:
 *     summary: Ativa ou inativa usuário
 */
router.patch("/:id/status", validate(statusSchemaBody), asyncHandler(controller.updateStatus));

module.exports = router;
