-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "report" JSONB,
    "ms" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentRun_caseId_createdAt_idx" ON "AgentRun"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

