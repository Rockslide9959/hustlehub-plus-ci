import { apiRequest, ApiError } from './client';
import { mockFetchResponse } from '../test/testUtils';

describe('apiRequest', () => {
  test('sends the token as a Bearer Authorization header', async () => {
    mockFetchResponse(200, { ok: true });

    await apiRequest('/api/auth/profile', { token: 'abc.def.ghi' });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer abc.def.ghi');
  });

  test('returns the parsed JSON on success', async () => {
    mockFetchResponse(200, { message: 'hello' });
    await expect(apiRequest('/api/test')).resolves.toEqual({ message: 'hello' });
  });

  test('shows user-facing validation messages from the API', async () => {
    mockFetchResponse(400, { error: 'Password must contain at least one number.' });
    await expect(apiRequest('/api/auth/register', { method: 'POST', body: {} })).rejects.toThrow(
      'Password must contain at least one number.'
    );
  });

  test('never shows raw server error text for a 500', async () => {
    mockFetchResponse(500, { message: 'MongoServerError: connection to cluster0 failed at db.js:7' });

    const error = await apiRequest('/api/test').catch((err) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.message).toBe('Something went wrong on our side. Please try again later.');
    expect(error.message).not.toMatch(/Mongo|db\.js/);
  });

  test('hides technical validation details', async () => {
    mockFetchResponse(400, { error: 'User validation failed: fullName: Path `fullName` is longer' });
    await expect(apiRequest('/api/test')).rejects.toThrow(
      'Some of the information you entered is not valid.'
    );
  });

  test('treats a 401 on an authenticated request as an expired session', async () => {
    mockFetchResponse(401, { message: 'Invalid or expired token' });
    await expect(apiRequest('/api/auth/profile', { token: 'old' })).rejects.toThrow(
      'Your session has expired. Please log in again.'
    );
  });

  test('explains rate limiting (429)', async () => {
    mockFetchResponse(429, { error: 'Too many authentication attempts. Please try again later.' });
    await expect(apiRequest('/api/auth/login', { method: 'POST', body: {} })).rejects.toThrow(
      'Too many authentication attempts. Please try again later.'
    );
  });

  test('handles the server being unreachable', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(apiRequest('/api/test')).rejects.toThrow(
      "Can't reach the server. Check your connection and try again."
    );
  });
});