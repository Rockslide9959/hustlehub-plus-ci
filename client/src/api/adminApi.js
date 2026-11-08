import { apiRequest } from './client';

// Admin-only endpoints.
function pageQuery(page) {
  return page && page > 1 ? `?page=${page}` : '';
}

export function listUsers(token, page) {
  return apiRequest(`/api/admin/users${pageQuery(page)}`, { token });
}

export function listAllGigs(token, page) {
  return apiRequest(`/api/admin/gigs${pageQuery(page)}`, { token });
}