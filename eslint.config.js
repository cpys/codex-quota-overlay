import js from '@eslint/js';

const nodeGlobals = {
  Buffer: 'readonly',
  AbortSignal: 'readonly',
  __dirname: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  process: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly',
  crypto: 'readonly',
  Response: 'readonly',
  TextEncoder: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly'
};

const browserGlobals = {
  document: 'readonly',
  navigator: 'readonly',
  requestAnimationFrame: 'readonly',
  ResizeObserver: 'readonly',
  window: 'readonly'
};

export default [
  {
    ignores: ['artifacts/**', 'build/native/**', 'node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: nodeGlobals,
      sourceType: 'module'
    },
    rules: {
      'no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_'}]
    }
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: {...nodeGlobals, module: 'readonly', require: 'readonly'},
      sourceType: 'commonjs'
    }
  },
  {
    files: ['src/renderer/**/*.js', 'site/**/*.js'],
    languageOptions: {
      globals: browserGlobals
    }
  }
];
