// Central helper for every request the frontend makes to the backend.
// It attaches the JWT, parses the response, and converts failures into
// friendly messages so raw server errors are never shown to the user.

export class ApiError extends Error {
  constructor(message, status, fieldErrors = {}, retryAfterSeconds = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    // Seconds until the request may be retried (locked account, rate limit)
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Reads retryAfterSeconds from the response, accepting only a sensible
// whole number (at most one day) so a bad value can never break the UI.
function getRetryAfterSeconds(data) {
  const value = data && data.retryAfterSeconds;
  return Number.isInteger(value) && value > 0 && value <= 86400 ? value : 0;
}

function getFieldErrors(data) {
  if (!data || !Array.isArray(data.errors)) return {};
  const fieldErrors = {};
  for (const item of data.errors) {
    if (
      item &&
      typeof item.field === 'string' &&
      typeof item.message === 'string' &&
      item.message.length <= 150 &&
      !/[${}<>]/.test(item.message)
    ) {
      fieldErrors[item.field] = item.message;
    }
  }
  return fieldErrors;
}

// Messages shown to the user for each kind of failure.
const FRIENDLY_MESSAGES = {
  network: "Can't reach the server. Check your connection and try again.",
  400: 'Some of the information you entered is not valid.',
  401: 'Invalid email or password.',
  sessionExpired: 'Your session has expired. Please log in again.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: 'That record already exists.',
  423: 'This account is temporarily locked. Please try again later.',
  429: 'Too many attempts. Please wait a few minutes and try again.',
  server: 'Something went wrong on our side. Please try again later.',
};

// The Part 1 backend sends errors as { error: '...' } on some routes and
// { message: '...' } on others, so check both.
function getServerMessage(data) {
  if (!data || typeof data !== 'object') return null;
  const text = data.error || data.message;
  if (typeof text !== 'string') return null;

  // Only pass through short, user-facing messages. Long or technical text
  // (for example a raw Mongoose "validation failed" message) is replaced.
  if (text.length > 150 || /validation failed|mongo|stack|exception/i.test(text)) {
    return null;
  }
  return text;
}

function buildFriendlyMessage(status, data, hadToken) {
  const serverMessage = getServerMessage(data);

  // Validation, duplicate, account-locked and rate-limit messages from our API
  // are written for users (e.g. "Password must contain at least one number."),
  // so show them.
  if ([400, 409, 423, 429].includes(status)) {
    return serverMessage || FRIENDLY_MESSAGES[status];
  }

  // A 401 on a request that sent a token means the token was rejected.
  if (status === 401) {
    return hadToken ? FRIENDLY_MESSAGES.sessionExpired : FRIENDLY_MESSAGES[401];
  }

  if (status === 403 || status === 404) {
    return FRIENDLY_MESSAGES[status];
  }

  // 500 and anything unexpected: never show the server's text.
  return FRIENDLY_MESSAGES.server;
}

/**
 * Send a request to the backend.
 * @param {string} path    e.g. '/api/auth/login'
 * @param {object} options { method, body, token }
 * @returns the parsed JSON response on success
 * @throws ApiError with a friendly message on failure
 */
export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    // The backend's verifyToken middleware expects "Bearer <token>".
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only throws when the request could not be sent at all.
    throw new ApiError(FRIENDLY_MESSAGES.network, 0);
  }

  // Some failures (e.g. the proxy when the API is down) return non-JSON text.
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

   if (!response.ok) {
    throw new ApiError(
      buildFriendlyMessage(response.status, data, Boolean(token)),
      response.status,
      getFieldErrors(data),
      getRetryAfterSeconds(data)
    );
  }

  return data;
}