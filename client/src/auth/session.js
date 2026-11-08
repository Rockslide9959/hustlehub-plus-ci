// Stores the logged-in session (JWT + user details) in sessionStorage.
// sessionStorage is cleared when the tab closes, which limits how long a
// token remains available compared with localStorage.

const STORAGE_KEY = 'hustlehub.session';

// Reads the "exp" (expiry) claim from the JWT payload.
// This is NOT verification: only the backend can verify the signature.
// It is used purely so the frontend can discard tokens it knows are expired.
export function getTokenExpiry(token) {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64));
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  const expiry = getTokenExpiry(token);
  return !expiry || Date.now() >= expiry;
}

export function saveSession({ token, user }) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

// Returns { token, user } or null if there is no valid, unexpired session.
export function loadSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw);
    if (!session?.token || !session?.user || isTokenExpired(session.token)) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}