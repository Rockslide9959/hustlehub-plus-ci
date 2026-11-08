// Shared helpers for the tests.
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthProvider';
import { saveSession } from '../auth/session';
import App from '../App';

// Builds a JWT-shaped string. The frontend only reads the payload (it never
// verifies the signature), so a fake signature is enough for tests.
export function makeToken(claims = {}) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })
  );
  return `${header}.${payload}.test-signature`;
}

// Puts a logged-in session into sessionStorage, as if the user had logged in.
export function logInAs(role) {
  const user = { id: 'u1', fullName: 'Test User', email: 'test@example.com', role };
  saveSession({ token: makeToken({ id: user.id, email: user.email, role }), user });
  return user;
}

// Renders the whole app at a given address, with the real routes and auth.
export function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

// Makes the next fetch() call resolve like a server response.
export function mockFetchResponse(status, body) {
  global.fetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

export function mockRoutes(routes) {
  global.fetch.mockImplementation(async (url, options = {}) => {
    const match = routes[`${options.method || 'GET'} ${url}`];
    const [status, body] = match || [404, { message: 'Route not found' }];
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  });
}

export function fetchCalls() {
  return global.fetch.mock.calls.map(([url, options = {}]) => ({
    method: options.method || 'GET',
    url,
    body: options.body ? JSON.parse(options.body) : undefined,
  }));
}