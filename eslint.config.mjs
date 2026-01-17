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
      'next-env.d.ts', // Next.js 自動生成的類型宣告
    ],
  },

  // Base JavaScript config
  js.configs.recommended,

  // Global variables for Node.js and browser environments
  {
    languageOptions: {
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        WebSocket: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        EventTarget: 'readonly',
        MessageChannel: 'readonly',
        MessagePort: 'readonly',
        structuredClone: 'readonly',
        // Common test globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        jest: 'readonly',
      },
    },
  },

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
      // 降級為警告：許多情況下 effect 中的 setState 是必要的（初始化、localStorage 讀取等）
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  // Custom rules for all TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Allow console in specific files
      'no-console': 'warn',

      // TypeScript specific
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
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
    files: ['**/*.test.ts', '**/*.test.tsx', '**/tests/**/*.ts', '**/tests/**/*.tsx', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // 放寬測試文件中的未使用變數檢查
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^(_|vi|beforeEach|afterEach|beforeAll|afterAll|expect|describe|it|test)',
        caughtErrorsIgnorePattern: '^_',
      }],
      // 允許測試中使用控制字符正則表達式（用於 ANSI 顏色測試）
      'no-control-regex': 'off',
      // 允許測試中的無意義轉義（某些測試可能需要）
      'no-useless-escape': 'off',
      // 允許測試中的匿名組件（如 wrapper 函數）
      'react/display-name': 'off',
    },
  },
);
