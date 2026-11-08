import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
    // Test files: allow Jest's globals (describe, test, expect, jest) and Node's (require).
  {
    files: ['**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  // Playwright config and specs run in Node, not the browser.
  {
    files: ['playwright.config.js', 'e2e/**'],
    languageOptions: { globals: { ...globals.node } },
  },
])
