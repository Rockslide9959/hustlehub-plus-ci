// Runs before every test file.
// Adds matchers such as toBeInTheDocument() and resets shared state between tests.
import '@testing-library/jest-dom';

beforeEach(() => {
  // Each test starts logged out.
  sessionStorage.clear();
  // jsdom has no real network. Each test decides what the "server" returns.
  global.fetch = jest.fn();
});