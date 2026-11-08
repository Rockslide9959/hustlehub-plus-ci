import { ROLES, ALL_ROLES } from './auth/roles';

// Which roles can see each menu link.
// This only controls what is SHOWN. The backend enforces access on every request.
export const NAV_LINKS = [
  { to: '/', label: 'Dashboard', roles: ALL_ROLES },
  { to: '/gigs', label: 'Browse gigs', roles: ALL_ROLES },
  { to: '/gigs/mine', label: 'My gigs', roles: [ROLES.FREELANCER] },
  { to: '/gigs/new', label: 'Create gig', roles: [ROLES.FREELANCER] },
  { to: '/bookings', label: 'My bookings', roles: [ROLES.CLIENT, ROLES.FREELANCER] },
  { to: '/income', label: 'Income', roles: [ROLES.FREELANCER] },
  { to: '/admin', label: 'Admin', roles: [ROLES.ADMIN] },
  { to: '/profile', label: 'Profile', roles: ALL_ROLES },
];

export function linksForRole(role) {
  return NAV_LINKS.filter((link) => link.roles.includes(role));
}

