import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// Reuse a single PrismaClient across hot reloads (dev) and test files.
const globalForPrisma = globalThis as unknown as { __steakzPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.__steakzPrisma ??
  new PrismaClient({
    datasourceUrl: env.DATABASE_URL,
    log: env.isTest ? [] : env.isProduction ? ['error'] : ['error', 'warn'],
  });

if (!env.isProduction) {
  globalForPrisma.__steakzPrisma = prisma;
}
