// Client-side validation that mirrors the backend rules in
// api/middleware/validateAuthInput.js. This improves usability only:
// the backend validates every request again, because frontend checks
// can be bypassed (e.g. by sending requests directly with Postman).

// One "@", no spaces, and a dot in the domain. Written so there is only one
// way to match, so the regex engine never has to backtrack (avoids ReDoS).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;
export const ALLOWED_ROLES = ['client', 'freelancer'];

// Returns the first password rule that fails, or null if the password is valid.
export function getPasswordProblem(password) {
  if (password.length < 8 || password.length > 72) {
    return 'Password must be between 8 and 72 characters.';
  }
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/\d/.test(password)) return 'Password must contain at least one number.';
  return null;
}

export function validateLogin({ email, password }) {
  const errors = {};

  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

export function validateRegistration({ fullName, email, password, confirmPassword, role }) {
  const errors = {};
  const name = fullName.trim();

  // The User model allows at most 80 characters, so use that limit.
  if (!name) {
    errors.fullName = 'Full name is required.';
  } else if (name.length < 2 || name.length > 80) {
    errors.fullName = 'Full name must be between 2 and 80 characters.';
  }

  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  const passwordProblem = getPasswordProblem(password);
  if (passwordProblem) {
    errors.password = passwordProblem;
  }

  if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (!ALLOWED_ROLES.includes(role)) {
    errors.role = 'Choose whether you are a client or a freelancer.';
  }

  return errors;
}