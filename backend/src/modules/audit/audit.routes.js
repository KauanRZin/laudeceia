const express = require("express");
const { z } = require("zod");
const auth = require("../../middlewares/auth");
const { requireRole } = require("../../middlewares/authorize");
const validate = require("../../middlewares/validate");
const asyncHandler = require("../../utils/asyncHandler");
const { listAuditLogs } = require("./audit.service");

const schema = z.object({ query: z.object({
  inicio: z.string().date("Informe uma data inicial válida"),
  fim: z.string().date("Informe uma data final válida"),
  action: z.enum(["CLIENT_CREATED", "CLIENT_UPDATED", "CLIENT_DELETED", "INSURANCE_CREATED", "INSURANCE_UPDATED", "INSURANCE_DELETED", "INSURANCE_ARCHIVED", "IMPORT_COMPLETED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).refine(query => query.inicio <= query.fim, { path: ["fim"], message: "A data final deve ser posterior ou igual à inicial" }) });

const router = express.Router();
router.use(auth, requireRole("SUPERADMIN"));
router.get("/", validate(schema), asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store").json(await listAuditLogs(req.validated.query));
}));

module.exports = router;
