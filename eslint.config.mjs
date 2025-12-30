import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'pages.bak/**',
      'specs/**',
      '*.config.js',
      '*.config.mjs',
      'prisma.config.ts',
      'src/generated/**',
    ],
  },

  // Base JavaScript config
  js.configs.recommended,

  // TypeScript files configuration
  ...tseslint.configs.recommended,

  // React configuration
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },

  // Custom rules for all TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Allow console in specific files
      'no-console': 'warn',

      // TypeScript specific
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Scripts and CLI files - allow console
  {
    files: ['**/scripts/**/*.ts', '**/src/scripts/**/*.ts', '**/cli/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Test files
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
