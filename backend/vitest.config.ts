import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'],
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: [
        'src/modules/**/*.service.ts',
        'src/modules/**/*.validator.ts',
        'src/modules/economic-engine/**/*.ts',
      ],
      exclude: ['src/modules/**/*.routes.ts', 'src/modules/**/*.types.ts'],
    },
  },
});
