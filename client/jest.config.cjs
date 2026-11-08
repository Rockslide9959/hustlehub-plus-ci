// Jest configuration for the React frontend.
module.exports = {
  // Simulate a browser (document, window, sessionStorage) inside Node.
  testEnvironment: 'jsdom',
  // Runs before the test environment loads.
  setupFiles: ['<rootDir>/src/test/polyfills.js'],
  // Runs before each test file, after the environment is ready.
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.js'],
  // Tests don't need real CSS, so replace CSS imports with an empty stand-in.
  moduleNameMapper: {
    '\\.(css)$': 'identity-obj-proxy',
  },
  testMatch: ['<rootDir>/src/**/*.test.{js,jsx}'],
};