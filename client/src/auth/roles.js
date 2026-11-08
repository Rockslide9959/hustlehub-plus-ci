// Role names must match the backend User model: ['client', 'admin', 'freelancer'].
export const ROLES = {
  CLIENT: 'client',
  FREELANCER: 'freelancer',
  ADMIN: 'admin',
};

export const ALL_ROLES = Object.values(ROLES);