const jwt = require('jsonwebtoken');

// The short-lived "half login" token used between the two login steps.
//
// After a correct password on an account with 2FA on, the API does NOT hand
// out a normal JWT. It returns this challenge token instead, which proves
// only "this person knew the password a moment ago". It is swapped for the
// real JWT at POST /api/auth/2fa/verify together with a valid 6-digit code.
//
// It cannot be used as a normal login token: it has its own audience
// ("hustlehub-2fa"), which verifyToken rejects, and it expires in 5 minutes.

const CHALLENGE_AUDIENCE = 'hustlehub-2fa';
const ISSUER = 'hustlehub-api';
const PURPOSE = '2fa-challenge';

const createTwoFactorChallenge = (user) =>
  jwt.sign(
    { id: String(user._id), purpose: PURPOSE },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '5m',
      issuer: ISSUER,
      audience: CHALLENGE_AUDIENCE
    }
  );

// Returns the user id from a valid challenge token, or null for anything else
// (expired, tampered, a normal login token, or not a token at all)
const readTwoFactorChallenge = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: CHALLENGE_AUDIENCE
    });
    return decoded && decoded.purpose === PURPOSE && decoded.id ? decoded.id : null;
  } catch {
    return null;
  }
};

module.exports = { createTwoFactorChallenge, readTwoFactorChallenge };
