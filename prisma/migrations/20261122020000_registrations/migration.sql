-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnic" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "area" TEXT,
    "pensionNo" TEXT,
    "passwordHash" TEXT NOT NULL,
    "pinHash" TEXT,
    "checks" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedBy" TEXT,
    "decidedNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Registration_tenantId_status_idx" ON "Registration"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Registration_phone_idx" ON "Registration"("phone");

