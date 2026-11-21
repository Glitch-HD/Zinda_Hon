-- Face from the (simulated) NADRA CNIC photo instead of an office visit.
ALTER TABLE "MockNadraRecord" ADD COLUMN "faceDescriptor" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[];
ALTER TABLE "MockNadraRecord" ADD COLUMN "photoTakenAt" TIMESTAMP(3);
ALTER TABLE "Pensioner" ADD COLUMN "faceSource" TEXT;
