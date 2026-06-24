const express = require("express");
const controller = require("./auth.controller");
const validate = require("../../middlewares/validate");
const auth = require("../../middlewares/auth");
const asyncHandler = require("../../utils/asyncHandler");
const { loginSchema } = require("./auth.schema");

const router = express.Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Autentica um usuário
 *     security: []
 *     responses:
 *       200:
 *         description: Token JWT e usuário autenticado
 */
router.post("/login", validate(loginSchema), asyncHandler(controller.login));

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Retorna o usuário autenticado
 *     responses:
 *       200:
 *         description: Usuário autenticado
 */
router.get("/me", auth, asyncHandler(controller.me));

module.exports = router;
