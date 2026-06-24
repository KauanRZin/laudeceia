const express = require("express");
const prisma = require("../../database/client");
const auth = require("../../middlewares/auth");
const asyncHandler = require("../../utils/asyncHandler");

const router = express.Router();
router.use(auth);

/**
 * @openapi
 * /vinculos:
 *   get:
 *     summary: Lista vínculos fixos
 */
router.get("/", asyncHandler(async (_req, res) => {
  const vinculos = await prisma.vinculo.findMany({ orderBy: { id: "asc" } });
  res.json(vinculos);
}));

module.exports = router;
