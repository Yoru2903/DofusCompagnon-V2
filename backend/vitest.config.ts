import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/modules/**/*.service.ts', 'src/modules/**/*.validator.ts'],
      exclude: ['src/modules/**/*.routes.ts', 'src/modules/**/*.types.ts'],
    },
  },
});
