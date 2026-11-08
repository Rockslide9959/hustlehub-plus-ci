// Authentication calls. Each function matches one backend route.
import { apiRequest } from './client';

// POST /api/auth/register -> { message, data: { id, fullName, email, role } }
export function registerUser({ fullName, email, password, role }) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: { fullName, email, password, role },
  });
}

// POST /api/auth/login -> { message, token, user: { id, fullName, email, role } }
export function loginUser({ email, password }) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

// GET /api/auth/profile (protected) -> { message, user }
export function getProfile(token) {
  return apiRequest('/api/auth/profile', { token });
}