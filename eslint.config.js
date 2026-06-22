import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'backend/generated/**',
      '**/vitest.config.ts',
      '**/vite.config.ts',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        console: 'readonly',
        fetch: 'readonly',
        window: 'readonly',
        document: 'readonly',
        process: 'readonly',
      },
      parserOptions: {
        projectService: true,
        allowDefaultProject: [
          '*.config.js',
          '*.config.ts',
          'vitest.config.ts',
          'vite.config.ts',
          'backend/*.config.ts',
          'frontend/*.config.ts',
        ],
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
