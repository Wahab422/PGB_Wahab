const js = require('@eslint/js');
const globals = require('globals');
const eslintPluginPrettier = require('eslint-plugin-prettier');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
  // Build output — not linted.
  {
    ignores: ['dist/**'],
  },

  // Catches real bugs the old config let through: undefined variables,
  // unreachable code, empty blocks, duplicate keys, …
  js.configs.recommended,

  // Browser code (the site bundle).
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Provided by other scripts on the Webflow page, or put on window by
        // src/components/gsap.js for code that uses them as bare globals.
        gsap: 'readonly',
        ScrollTrigger: 'readonly',
        lottie: 'readonly',
        mapboxgl: 'readonly',
        Webflow: 'readonly',
        // Referenced defensively by utils/logger.js (typeof-guarded).
        process: 'readonly',
      },
    },
  },

  {
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      ...eslintConfigPrettier.rules,
      'prettier/prettier': 'error',
      // Site code logs through utils/logger.js (debug output is stripped from
      // production builds; warnings and errors are kept).
      'no-console': 'warn',
      // caughtErrors: 'none' keeps ESLint 8's behaviour for `catch (error)`.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // Node scripts and config files (last, so these overrides win).
  {
    files: ['bin/**/*.js', 'scripts/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
