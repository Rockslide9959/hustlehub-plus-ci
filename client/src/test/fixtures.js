import { formatPrice } from '../utils/format';

// Sample API data shaped like the real backend responses (see api/utils/gigSerializer.js).
// logInAs() in testUtils gives the logged-in user the id 'u1'.

export const ownGig = {
  id: '665f1a2b3c4d5e6f7a8b9c01',
  title: 'Logo design for small businesses',
  description: 'A clean, modern logo with three revisions and all source files.',
  price: 750,
  category: 'Design',
  isActive: true,
  freelancer: { id: 'u1', fullName: 'Test User' },
  createdAt: '2026-10-01T10:00:00.000Z',
};

export const otherGig = {
  id: '665f1a2b3c4d5e6f7a8b9c02',
  title: 'React landing page build',
  description: 'A responsive landing page built in React, delivered within a week.',
  price: 2500.5,
  category: 'Development',
  isActive: true,
  freelancer: { id: 'u2', fullName: 'Naledi Khumalo' },
  createdAt: '2026-10-02T10:00:00.000Z',
};

export function gigList(gigs, pagination = { page: 1, limit: 12, total: gigs.length, pages: 1 }) {
  return { message: 'Gigs retrieved', data: gigs, pagination };
}

// Prices are formatted with non-breaking spaces ("R 2 500,50"), but Testing Library
// normalises whitespace in the page, so compare against the same normalised text.
export function shownPrice(amount) {
  return formatPrice(amount).replace(/\s/g, ' ');
}