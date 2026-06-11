// Runs before each test file (jest `setupFiles`).
// Forces the test environment so the Prisma client targets TEST_DATABASE_URL.
process.env.NODE_ENV = 'test';

try {
  process.loadEnvFile();
} catch {
  // .env may be absent in CI; vars are injected directly there.
}
