import { apiRequest } from './client';

export function listGigs(token, { q, category, sort, page } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (sort) params.set('sort', sort);
  if (page && page > 1) params.set('page', String(page));
  const query = params.toString();
  const path = query ? `/api/gigs?${query}` : '/api/gigs';
  return apiRequest(path, { token });
}

export function listMyGigs(token) {
  return apiRequest('/api/gigs/mine?limit=50', { token });
}

export function getGig(token, id) {
  return apiRequest(`/api/gigs/${encodeURIComponent(id)}`, { token });
}

export function createGig(token, gig) {
  return apiRequest('/api/gigs', { method: 'POST', token, body: gig });
}

export function updateGig(token, id, gig) {
  return apiRequest(`/api/gigs/${encodeURIComponent(id)}`, { method: 'PUT', token, body: gig });
}

export function deleteGig(token, id) {
  return apiRequest(`/api/gigs/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}