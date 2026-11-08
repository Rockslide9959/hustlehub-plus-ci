const User = require('../models/User');

// Account lockout with progressive delay (own security feature).
//
// How it works:
//   - Every wrong password (or, later, wrong 2FA code) adds 1 to the
//     account's failedLoginAttempts counter in the database.
//   - When the counter reaches LOCKOUT_MAX_ATTEMPTS, the account is locked.
//   - Each new lock lasts twice as long as the one before
//     (15 min -> 30 min -> 1 h -> 2 h -> ...), capped at LOCKOUT_MAX_MINUTES.
//   - Failures older than LOCKOUT_RESET_MINUTES are forgotten, so a few
//     typos spread over a day never lock anyone out.
//   - A successful login clears everything.
//
// Why it is stored on the account (and not just rate limited):
// the Part 2 rate limiter counts per computer + email and lives in memory.
// An attacker using many IP addresses, or a server restart, gets around it.
// This lock lives on the account in MongoDB, so neither of those helps.
//
// All settings can be changed in .env without touching code.

const MINUTE = 60 * 1000;

const readNumber = (name, fallback) => {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

// Read on every call so tests (and .env changes) take effect immediately
const getLockoutSettings = () => ({
  maxAttempts: readNumber('LOCKOUT_MAX_ATTEMPTS', 5),
  baseLockMs: readNumber('LOCKOUT_BASE_MINUTES', 15) * MINUTE,
  maxLockMs: readNumber('LOCKOUT_MAX_MINUTES', 240) * MINUTE,
  resetWindowMs: readNumber('LOCKOUT_RESET_MINUTES', 15) * MINUTE
});

// Length of a lock: doubles with every lock, never more than the cap.
// lockNumber 1 = first lock, 2 = second lock, and so on.
const calculateLockDurationMs = (lockNumber, settings = getLockoutSettings()) => {
  const safeLockNumber = Math.max(1, lockNumber);
  // The exponent is capped so the number can never overflow
  const duration = settings.baseLockMs * 2 ** Math.min(safeLockNumber - 1, 20);
  return Math.min(duration, settings.maxLockMs);
};

// Seconds left on a lock (0 when the account is not locked)
const getRemainingLockSeconds = (user, now = new Date()) => {
  if (!user || !user.lockUntil) {
    return 0;
  }
  const remainingMs = new Date(user.lockUntil).getTime() - now.getTime();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
};

const isAccountLocked = (user, now = new Date()) => getRemainingLockSeconds(user, now) > 0;

// Records a failed attempt and locks the account when the limit is reached.
// Uses atomic database updates, so many requests sent at the same moment
// cannot sneak in extra guesses or apply the same lock twice.
//
// Returns { locked, retryAfterSeconds, attemptsRemaining }
const recordFailedLogin = async (userId, now = new Date()) => {
  const settings = getLockoutSettings();

  // 1. Forget old failures (outside the reset window)
  await User.updateOne(
    { _id: userId, lastFailedLoginAt: { $lt: new Date(now.getTime() - settings.resetWindowMs) } },
    { $set: { failedLoginAttempts: 0 } }
  );

  // 2. Count this failure
  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { failedLoginAttempts: 1 }, $set: { lastFailedLoginAt: now } },
    { returnDocument: 'after', projection: { failedLoginAttempts: 1, lockoutCount: 1 } }
  );

  if (!updated) {
    return { locked: false, retryAfterSeconds: 0, attemptsRemaining: 0 };
  }

  if (updated.failedLoginAttempts < settings.maxAttempts) {
    return {
      locked: false,
      retryAfterSeconds: 0,
      attemptsRemaining: settings.maxAttempts - updated.failedLoginAttempts
    };
  }

  // 3. Limit reached: lock the account. The condition on the counter means
  //    only one of several simultaneous requests can apply the lock.
  const lockNumber = (updated.lockoutCount || 0) + 1;
  const lockMs = calculateLockDurationMs(lockNumber, settings);
  const lockUntil = new Date(now.getTime() + lockMs);

  await User.updateOne(
    { _id: userId, failedLoginAttempts: { $gte: settings.maxAttempts } },
    {
      $set: { lockUntil, failedLoginAttempts: 0 },
      $inc: { lockoutCount: 1 }
    }
  );

  return {
    locked: true,
    retryAfterSeconds: Math.ceil(lockMs / 1000),
    attemptsRemaining: 0
  };
};

// A successful login proves the real owner is back: clear the counters
const recordSuccessfulLogin = async (userId) => {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockUntil: null,
        lockoutCount: 0
      }
    }
  );
};

// The hidden lockout fields, for queries that need them (login)
const LOCKOUT_FIELDS = '+failedLoginAttempts +lastFailedLoginAt +lockUntil +lockoutCount';

module.exports = {
  getLockoutSettings,
  calculateLockDurationMs,
  getRemainingLockSeconds,
  isAccountLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
  LOCKOUT_FIELDS
};
