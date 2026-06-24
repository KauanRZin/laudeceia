const express = require("express");
const prisma = require("../../database/client");
const auth = require("../../middlewares/auth");
const asyncHandler = require("../../utils/asyncHandler");

const router = express.Router();
router.use(auth);

/**
 * @openapi
 * /insurance-types:
 *   get:
 *     summary: Lista tipos de seguro fixos
 */
router.get("/", asyncHandler(async (_req, res) => {
  const types = await prisma.insuranceType.findMany({ orderBy: { id: "asc" } });
  res.json(types);
}));

module.exports = router;
