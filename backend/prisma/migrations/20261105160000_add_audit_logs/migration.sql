CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog"("createdAt", "id");
CREATE INDEX "AuditLog_clientId_createdAt_idx" ON "AuditLog"("clientId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "Insurance_createdAt_idx" ON "Insurance"("createdAt");
CREATE INDEX "Insurance_updatedAt_idx" ON "Insurance"("updatedAt");
CREATE INDEX "Insurance_clientId_tipoId_idx" ON "Insurance"("clientId", "tipoId");
