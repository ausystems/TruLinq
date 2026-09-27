import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/* Lint the backend (server/, api/, tests/) with type-aware rules. The frontend keeps its own conventions. */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.data/**', 'src/**', 'public/**', 'scripts/**', 'members/**', 'api/**', 'vite.config.js', 'eslint.config.js', 'vitest.config.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['server/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }]
    }
  },
  { files: ['tests/**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'off' } }
);
