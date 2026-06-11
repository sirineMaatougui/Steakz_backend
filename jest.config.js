/**
 * Jest config for ESM + TypeScript (ts-jest).
 * Run with: NODE_OPTIONS=--experimental-vm-modules jest
 * Relative imports in source use the `.js` extension (NodeNext); the
 * moduleNameMapper below rewrites them back to the `.ts` source for Jest.
 */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  testTimeout: 30000,
  clearMocks: true,
};
