// Two-factor authentication calls. Each function matches one backend route.
import { apiRequest } from './client';

// GET /api/auth/2fa/status (protected) -> { enabled }
export function getTwoFactorStatus(token) {
  return apiRequest('/api/auth/2fa/status', { token });
}

// POST /api/auth/2fa/setup (protected) -> { message, qrCode, manualEntryKey }
export function startTwoFactorSetup(token) {
  return apiRequest('/api/auth/2fa/setup', { method: 'POST', token });
}

// POST /api/auth/2fa/enable (protected) -> { message, enabled: true }
export function enableTwoFactor(token, code) {
  return apiRequest('/api/auth/2fa/enable', { method: 'POST', token, body: { code } });
}

// POST /api/auth/2fa/disable (protected) -> { message, enabled: false }
export function disableTwoFactor(token, { password, code }) {
  return apiRequest('/api/auth/2fa/disable', { method: 'POST', token, body: { password, code } });
}

// POST /api/auth/2fa/verify (login step 2) -> same response as a normal login
export function verifyTwoFactorLogin({ challengeToken, code }) {
  return apiRequest('/api/auth/2fa/verify', { method: 'POST', body: { challengeToken, code } });
}
