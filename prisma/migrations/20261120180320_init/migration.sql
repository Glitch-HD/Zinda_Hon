-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PENSIONER', 'HELPER', 'SHOPKEEPER', 'OFFICER', 'ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DUE', 'IN_PROGRESS', 'NEEDS_PROOF', 'WITH_OFFICER', 'VERIFIED', 'STOPPED');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('APPROVE', 'ASK_MORE_PROOF', 'SEND_TO_OFFICER', 'OFFICER_APPROVED', 'OFFICER_STOPPED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'AI', 'AGENT', 'SYSTEM', 'API_CLIENT');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameUr" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'ur',
    "area" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pensioner" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "pensionNo" TEXT NOT NULL,
    "cnicMock" TEXT,
    "name" TEXT NOT NULL,
    "nameUr" TEXT,
    "nameNormalized" TEXT NOT NULL,
    "fatherOrHusbandName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "pensionType" TEXT NOT NULL,
    "monthlyAmount" INTEGER NOT NULL,
    "bankAccountNo" TEXT,
    "area" TEXT,
    "enrolledFaceDescriptor" DOUBLE PRECISION[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pensioner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelperLink" (
    "id" TEXT NOT NULL,
    "helperId" TEXT NOT NULL,
    "pensionerId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelperLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pensionerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'DUE',
    "assignedOfficerId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION,
    "riskFlags" TEXT[],
    "officerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStep" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "clientActionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "outcome" "Outcome" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "modelName" TEXT,
    "inputs" JSONB NOT NULL,
    "checkScores" JSONB NOT NULL,
    "reasonUr" TEXT NOT NULL,
    "reasonEn" TEXT NOT NULL,
    "auditTrace" JSONB NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "pensionerId" TEXT NOT NULL,
    "granteeType" TEXT NOT NULL,
    "granteeId" TEXT NOT NULL,
    "granteeName" TEXT NOT NULL,
    "fields" TEXT[],
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCorrectionRequest" (
    "id" TEXT NOT NULL,
    "pensionerId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DataCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckedMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submittedById" TEXT,
    "text" TEXT NOT NULL,
    "sender" TEXT,
    "area" TEXT,
    "label" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "route" TEXT NOT NULL,
    "reviewedLabel" TEXT,
    "modelName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "rateLimit" INTEGER NOT NULL DEFAULT 60,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockNadraRecord" (
    "id" TEXT NOT NULL,
    "cnic" TEXT,
    "name" TEXT NOT NULL,
    "nameUr" TEXT,
    "fatherOrHusbandName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "maritalStatus" TEXT,

    CONSTRAINT "MockNadraRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockBankAccount" (
    "id" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "cnic" TEXT,
    "lastActivity" TIMESTAMP(3),
    "withdrawalsLast90Days" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MockBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockDeathRecord" (
    "id" TEXT NOT NULL,
    "cnic" TEXT,
    "name" TEXT NOT NULL,
    "dateOfDeath" TIMESTAMP(3) NOT NULL,
    "registeredAt" TEXT NOT NULL,

    CONSTRAINT "MockDeathRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Pensioner_userId_key" ON "Pensioner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Pensioner_pensionNo_key" ON "Pensioner"("pensionNo");

-- CreateIndex
CREATE INDEX "Pensioner_tenantId_idx" ON "Pensioner"("tenantId");

-- CreateIndex
CREATE INDEX "Pensioner_cnicMock_idx" ON "Pensioner"("cnicMock");

-- CreateIndex
CREATE UNIQUE INDEX "HelperLink_helperId_pensionerId_key" ON "HelperLink"("helperId", "pensionerId");

-- CreateIndex
CREATE INDEX "Case_tenantId_status_idx" ON "Case"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Case_pensionerId_year_key" ON "Case"("pensionerId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "CaseStep_clientActionId_key" ON "CaseStep"("clientActionId");

-- CreateIndex
CREATE INDEX "Evidence_caseId_type_idx" ON "Evidence"("caseId", "type");

-- CreateIndex
CREATE INDEX "Decision_caseId_idx" ON "Decision"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleVersion_tenantId_ruleKey_version_key" ON "RuleVersion"("tenantId", "ruleKey", "version");

-- CreateIndex
CREATE INDEX "Consent_pensionerId_idx" ON "Consent"("pensionerId");

-- CreateIndex
CREATE INDEX "Consent_granteeId_idx" ON "Consent"("granteeId");

-- CreateIndex
CREATE INDEX "CheckedMessage_tenantId_createdAt_idx" ON "CheckedMessage"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefix_key" ON "ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "RateLimitHit_bucket_createdAt_idx" ON "RateLimitHit"("bucket", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "MockBankAccount_accountNo_key" ON "MockBankAccount"("accountNo");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pensioner" ADD CONSTRAINT "Pensioner_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pensioner" ADD CONSTRAINT "Pensioner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelperLink" ADD CONSTRAINT "HelperLink_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelperLink" ADD CONSTRAINT "HelperLink_pensionerId_fkey" FOREIGN KEY ("pensionerId") REFERENCES "Pensioner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_pensionerId_fkey" FOREIGN KEY ("pensionerId") REFERENCES "Pensioner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_assignedOfficerId_fkey" FOREIGN KEY ("assignedOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStep" ADD CONSTRAINT "CaseStep_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "RuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleVersion" ADD CONSTRAINT "RuleVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_pensionerId_fkey" FOREIGN KEY ("pensionerId") REFERENCES "Pensioner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataCorrectionRequest" ADD CONSTRAINT "DataCorrectionRequest_pensionerId_fkey" FOREIGN KEY ("pensionerId") REFERENCES "Pensioner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckedMessage" ADD CONSTRAINT "CheckedMessage_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
