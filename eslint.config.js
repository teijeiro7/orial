const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*', 'drizzle/*', 'supabase/*', 'node_modules/*'],
  },
  // Node-context config/plugin files (CommonJS, run outside the app bundle).
  {
    files: ['*.config.js', 'jest.setup.js', 'metro-sql-transformer.js', 'plugins/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
  // ponytail: pre-existing violations predate this lint setup (plan 001 is config-only,
  // no source changes) — downgraded to warn so `npm run lint` gates on new issues without
  // blocking on the backlog. Raise back to 'error' as each rule's backlog is cleared.
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react/no-unescaped-entities': 'warn',
      'expo/no-dynamic-env-var': 'warn',
    },
  },
];
