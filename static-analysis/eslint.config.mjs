// Static code analysis for HustleHub+ (owner: Ethan).
//
// Two rule sets are run over all application code:
//   - SonarJS: the same JavaScript rule engine that SonarQube and SonarCloud
//     use (bugs, code smells and security hotspots).
//   - eslint-plugin-security: Node.js security rules (ReDoS, unsafe regex,
//     eval, child processes, insecure randomness and similar).
//
// Run it from this folder with `npm ci` then `npm run scan` (or `npm run
// report` to also save every scanned file and its findings to
// reports/static-analysis-report.json). Any finding fails
// the scan, so the CI pipeline fails too.
//
// Test code, generated files and third-party code are not scanned.

import sonarjs from 'eslint-plugin-sonarjs';
import security from 'eslint-plugin-security';
import globals from 'globals';

export default [
  {
    // Paths are relative to the repository root (the scripts run from there)
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'api/__tests__/**',
      'client/src/test/**',
      'client/e2e/**',
      '**/*.test.js',
      '**/*.test.jsx',
    ],
  },
  {
    // The app code carries eslint-disable comments for the client's own ESLint
    // setup; those are not this tool's concern, so don't report them here.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    files: ['api/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
  {
    files: ['client/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  sonarjs.configs.recommended,
  security.configs.recommended,

  {
    rules: {
      // Turned off project-wide: it flags every obj[key] access, even with
      // keys that come from our own code (field names, lookup tables). It is a
      // well-known source of false positives and SonarJS has no equivalent.
      // Real object-injection risks (__proto__, constructor, $ operators) are
      // blocked at runtime by api/middleware/sanitizeInput.js.
      'security/detect-object-injection': 'off',
    },
  },

  // -------------------------------------------------------------------------
  // Reviewed findings. Each one was checked by hand and is safe for the
  // reason given. They are switched off ONLY for the named file, so the same
  // rule still catches new problems everywhere else.
  // -------------------------------------------------------------------------
  {
    // DNS servers 8.8.8.8 / 8.8.4.4 are set on purpose: some Windows setups
    // cannot resolve the MongoDB Atlas SRV record without them. They are
    // public resolvers, not internal addresses or secrets.
    // The HTTPS certificate paths come from the server's own .env
    // (SSL_KEY_PATH, SSL_CERT_PATH), never from a request.
    files: ['api/server.js'],
    rules: {
      'sonarjs/no-hardcoded-ip': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    // The gig search builds a RegExp from the user's search text, but every
    // regex special character is escaped first (SafeText), so the text can
    // only ever match literally: no regex injection and no ReDoS.
    files: ['api/controllers/gigController.js'],
    rules: { 'security/detect-non-literal-regexp': 'off' },
  },
  {
    // "Hard-coded passwords" here are error MESSAGES assigned to
    // errors.password (e.g. 'Password is required.'), not credentials.
    // The "timing attack" is the register form comparing its two password
    // boxes in the user's own browser; there is no secret to leak.
    files: ['client/src/utils/validation.js'],
    rules: {
      'sonarjs/no-hardcoded-passwords': 'off',
      'security/detect-possible-timing-attacks': 'off',
    },
  },
];
