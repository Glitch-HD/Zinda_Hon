-- Backup 4-digit PIN for pensioner login
ALTER TABLE "User" ADD COLUMN "pinHash" TEXT;
