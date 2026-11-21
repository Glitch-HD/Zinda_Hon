// Seed runner: creates the demo data (see lib/demo-seed.ts). Runs on every deploy.
import { PrismaClient } from "@prisma/client";
import { runSeed } from "../lib/demo-seed";

const prisma = new PrismaClient();
runSeed(prisma)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
