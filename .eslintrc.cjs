module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs', 'coverage'],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // `_`-prefixed args are the documented "intentionally unused" convention.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // Empty catch blocks are used deliberately where a failure is non-fatal;
    // each one carries a comment explaining why there is nothing to do.
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**'],
      env: { node: true },
    },
    {
      // The procedural-geometry modules deliberately export builder functions
      // and helpers alongside components — that colocation is the point of the
      // module. The rule only guards HMR ergonomics, so it is off here.
      files: ['src/components/canvas/models/*.tsx'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
  ],
};
