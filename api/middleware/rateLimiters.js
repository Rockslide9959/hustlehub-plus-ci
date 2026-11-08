const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Rate limiters for the HustleHub+ API.
//
// Every limiter answers in the same way when it is exceeded:
//   429 Too Many Requests
//   { message: 'Too many ... Please try again in N minutes.', retryAfterSeconds: N }
// plus the standard RateLimit and Retry-After headers, so both people and
// programs know exactly when they may try again.
//
// The limits can be changed in .env (see .env.example) without touching code.

const MINUTE = 60 * 1000;

const readLimit = (name, fallback) => {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

// Builds a limiter with the shared 429 response
const createLimiter = ({ windowMs, limit, reason, keyGenerator, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next, options) => {
      const resetTime = req.rateLimit && req.rateLimit.resetTime;
      const retryAfterSeconds = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(options.windowMs / 1000);
      const minutes = Math.ceil(retryAfterSeconds / 60);

      // Server-side record of the blocked request (never sent to the client)
      console.warn(`Rate limit hit on ${req.method} ${req.originalUrl} from ${req.ip}`);

      res.status(options.statusCode).json({
        message: `${reason} Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        retryAfterSeconds
      });
    }
  });

// Login: 5 FAILED attempts per 15 minutes for each computer + email pair.
// Successful logins are not counted, so real users are never locked out by
// their own normal use, while password guessing on an account is stopped.
const loginLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: readLimit('RATE_LIMIT_LOGIN_MAX', 5),
  reason: 'Too many failed login attempts.',
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return `${ipKeyGenerator(req.ip)}:${email}`;
  }
});

// Register: 10 new accounts per hour from one computer (stops mass fake sign-ups)
const registerLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: readLimit('RATE_LIMIT_REGISTER_MAX', 10),
  reason: 'Too many accounts created from this network.'
});

// Bookings: 5 per 15 minutes for each logged-in client (stops booking spam).
// Runs after verifyToken, so it counts per user rather than per computer.
const bookingLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: readLimit('RATE_LIMIT_BOOKING_MAX', 5),
  reason: 'Too many booking attempts.',
  keyGenerator: (req) => `user:${req.user.id}`
});

// Two-factor codes: 10 WRONG codes per 15 minutes for each logged-in user.
// A 6-digit code has a million combinations; this keeps guessing hopeless.
// Runs after verifyToken, so it counts per user rather than per computer.
const twoFactorLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: readLimit('RATE_LIMIT_2FA_MAX', 10),
  reason: 'Too many incorrect codes.',
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `user:${req.user.id}`
});

// Whole API: 300 requests per 15 minutes from one computer (stops flooding)
const apiLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: readLimit('RATE_LIMIT_API_MAX', 300),
  reason: 'Too many requests.'
});

module.exports = {
  loginLimiter,
  registerLimiter,
  bookingLimiter,
  twoFactorLimiter,
  apiLimiter
};
