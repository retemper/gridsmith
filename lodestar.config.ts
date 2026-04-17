import { defineConfig } from '@retemper/lodestar';
import { eslintAdapter } from '@retemper/lodestar-adapter-eslint';
import { huskyAdapter } from '@retemper/lodestar-adapter-husky';
import { lintStagedAdapter } from '@retemper/lodestar-adapter-lint-staged';
import { prettierAdapter } from '@retemper/lodestar-adapter-prettier';
import { pluginArchitecture } from '@retemper/lodestar-plugin-architecture';
import importX from 'eslint-plugin-import-x';
import unicorn from 'eslint-plugin-unicorn';

export default defineConfig([
  {
    adapters: [
      eslintAdapter({
        presets: ['strict'],
        plugins: {
          'import-x': importX,
          unicorn,
        },
        rules: {
          '@typescript-eslint/consistent-type-imports': 'error',
          '@typescript-eslint/no-unused-vars': [
            'error',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
          ],
          'import-x/no-default-export': 'error',
          'import-x/order': [
            'error',
            {
              groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
              'newlines-between': 'always',
              alphabetize: { order: 'asc' },
            },
          ],
          'no-console': ['warn', { allow: ['warn', 'error'] }],
          'unicorn/prefer-node-protocol': 'error',
          'unicorn/no-null': 'off',
          'unicorn/prevent-abbreviations': 'off',
        },
        overrides: [
          {
            files: ['**/*.config.ts', '**/vitest.workspace.ts'],
            rules: { 'import-x/no-default-export': 'off' },
          },
          {
            files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
            rules: {
              '@typescript-eslint/no-non-null-assertion': 'off',
              '@typescript-eslint/no-explicit-any': 'off',
            },
          },
        ],
        ignores: ['**/dist/', '**/coverage/', '**/node_modules/', '**/*.js', '**/*.mjs'],
      }),
      prettierAdapter({
        printWidth: 100,
        tabWidth: 2,
        semi: true,
        singleQuote: true,
        trailingComma: 'all',
      }),
      huskyAdapter({
        hooks: {
          'pre-commit': ['npx lint-staged'],
          'pre-push': ['pnpm turbo build type-check', 'pnpm turbo test -- --coverage'],
        },
      }),
      lintStagedAdapter({
        commands: {
          '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
          '*.{json,md,yaml,yml}': ['prettier --write'],
        },
      }),
    ],
  },
  {
    plugins: [pluginArchitecture],
    rules: {
      'architecture/no-circular': 'error',
      'architecture/layers': {
        severity: 'error',
        options: {
          layers: [
            {
              name: 'core',
              path: 'packages/core/src/**/*.ts',
            },
            {
              name: 'react',
              path: 'packages/react/src/**/*.ts',
              canImport: ['core'],
            },
            {
              name: 'ui',
              path: 'packages/ui/src/**/*.ts',
              canImport: ['core', 'react'],
            },
          ],
        },
      },
    },
  },
]);
