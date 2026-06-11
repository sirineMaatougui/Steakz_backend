import { z } from 'zod';

// Load .env into process.env (Node 24 built-in). No-op if the file is absent.
try {
  process.loadEnvFile();
} catch {
  // .env may legitimately be absent in CI / production (vars injected directly).
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  ADMIN_EMAIL: z.string().min(3),
  ADMIN_PASSWORD: z.string().min(6),
  ADMIN_NAME: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`❌ Invalid/missing environment variables:\n${issues}`);
}

const data = parsed.data;

// In the test environment, point the database at the dedicated test DB.
const databaseUrl =
  data.NODE_ENV === 'test' && data.TEST_DATABASE_URL ? data.TEST_DATABASE_URL : data.DATABASE_URL;

export const env = {
  ...data,
  DATABASE_URL: databaseUrl,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
};

export type Env = typeof env;
