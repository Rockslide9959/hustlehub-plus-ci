const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');

// Own security feature: account lockout with progressive delay.
// No real MongoDB is needed: the User model is replaced by a small fake that
// keeps one account in memory and understands the exact updates the lockout
// service sends (including the conditions that make them race-proof).

let account;

const matches = (filter) => {
  if (filter.lastFailedLoginAt) {
    const cutoff = filter.lastFailedLoginAt.$lt;
    if (!account.lastFailedLoginAt || !(account.lastFailedLoginAt < cutoff)) return false;
  }
  if (filter.failedLoginAttempts) {
    if (!(account.failedLoginAttempts >= filter.failedLoginAttempts.$gte)) return false;
  }
  return true;
};

const applyUpdate = (update) => {
  Object.assign(account, update.$set || {});
  Object.entries(update.$inc || {}).forEach(([field, amount]) => {
    account[field] += amount;
  });
};

jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

// Keep the Part 2 IP rate limiter out of the way, so these tests prove the
// lockout on its own (the limiter would otherwise answer 429 first)
jest.mock('../middleware/rateLimiters', () => ({
  loginLimiter: (req, res, next) => next(),
  registerLimiter: (req, res, next) => next(),
  twoFactorLimiter: (req, res, next) => next()
}));

const User = require('../models/User');
const {
  getLockoutSettings,
  calculateLockDurationMs,
  getRemainingLockSeconds,
  isAccountLocked,
  recordFailedLogin,
  recordSuccessfulLogin
} = require('../utils/accountLockout');
const authRoutes = require('../routes/authRoutes');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

const MINUTE = 60 * 1000;
const EMAIL = 'lockout.test@example.com';
const GOOD_PASSWORD = 'GoodPass123';
const WRONG_PASSWORD = 'WrongPass123';

const login = (password, email = EMAIL) =>
  request(app).post('/api/auth/login').send({ email, password });

let passwordHash;

beforeAll(async () => {
  process.env.JWT_SECRET = 'jest-only-secret-not-for-production';
  // Low cost factor keeps the tests fast; real hashing uses 12 rounds
  passwordHash = await bcrypt.hash(GOOD_PASSWORD, 4);
});

beforeEach(() => {
  account = {
    _id: 'user-1',
    fullName: 'Lockout Tester',
    email: EMAIL,
    role: 'client',
    passwordHash,
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lockUntil: null,
    lockoutCount: 0
  };

  User.findOne.mockImplementation((filter) => ({
    select: async () => (filter.email === account.email ? { ...account } : null)
  }));
  User.updateOne.mockImplementation(async (filter, update) => {
    if (matches(filter)) applyUpdate(update);
    return { acknowledged: true };
  });
  User.findOneAndUpdate.mockImplementation(async (filter, update) => {
    applyUpdate(update);
    return { ...account };
  });
});

afterEach(() => {
  jest.clearAllMocks();
  delete process.env.LOCKOUT_MAX_ATTEMPTS;
  delete process.env.LOCKOUT_BASE_MINUTES;
  delete process.env.LOCKOUT_MAX_MINUTES;
});

describe('lockout settings and lock length', () => {
  test('uses safe defaults: 5 attempts, 15 min lock, 4 h cap, 15 min reset window', () => {
    expect(getLockoutSettings()).toEqual({
      maxAttempts: 5,
      baseLockMs: 15 * MINUTE,
      maxLockMs: 240 * MINUTE,
      resetWindowMs: 15 * MINUTE
    });
  });

  test('each new lock lasts twice as long, up to the cap', () => {
    const minutes = [1, 2, 3, 4, 5, 6, 50].map((n) => calculateLockDurationMs(n) / MINUTE);
    expect(minutes).toEqual([15, 30, 60, 120, 240, 240, 240]);
  });

  test('settings can be changed through environment variables', () => {
    process.env.LOCKOUT_MAX_ATTEMPTS = '3';
    process.env.LOCKOUT_BASE_MINUTES = '1';
    expect(getLockoutSettings().maxAttempts).toBe(3);
    expect(calculateLockDurationMs(1)).toBe(1 * MINUTE);
  });

  test('invalid environment values fall back to the defaults', () => {
    process.env.LOCKOUT_MAX_ATTEMPTS = 'not-a-number';
    expect(getLockoutSettings().maxAttempts).toBe(5);
  });

  test('reports the time left on a lock, and zero when unlocked', () => {
    const now = new Date();
    expect(getRemainingLockSeconds({ lockUntil: new Date(now.getTime() + 90 * 1000) }, now)).toBe(90);
    expect(isAccountLocked({ lockUntil: new Date(now.getTime() - 1000) }, now)).toBe(false);
    expect(isAccountLocked({ lockUntil: null }, now)).toBe(false);
    expect(isAccountLocked(null, now)).toBe(false);
  });
});

describe('recording failed and successful logins', () => {
  test('counts down the attempts and locks the account on the 5th failure', async () => {
    const results = [];
    for (let i = 0; i < 5; i += 1) {
      results.push(await recordFailedLogin(account._id));
    }

    expect(results.map((r) => r.attemptsRemaining)).toEqual([4, 3, 2, 1, 0]);
    expect(results[4]).toMatchObject({ locked: true, retryAfterSeconds: 15 * 60 });
    expect(isAccountLocked(account)).toBe(true);
    expect(account.lockoutCount).toBe(1);
    expect(account.failedLoginAttempts).toBe(0);
  });

  test('a second lock lasts twice as long (progressive delay)', async () => {
    for (let i = 0; i < 10; i += 1) {
      await recordFailedLogin(account._id);
    }

    expect(account.lockoutCount).toBe(2);
    expect(Math.round(getRemainingLockSeconds(account) / 60)).toBe(30);
  });

  test('failures older than the reset window are forgotten', async () => {
    account.failedLoginAttempts = 4;
    account.lastFailedLoginAt = new Date(Date.now() - 20 * MINUTE);

    const result = await recordFailedLogin(account._id);

    expect(result.locked).toBe(false);
    expect(account.failedLoginAttempts).toBe(1);
  });

  test('a burst of simultaneous failures applies only one lock', async () => {
    await Promise.all(Array.from({ length: 12 }, () => recordFailedLogin(account._id)));

    expect(account.lockoutCount).toBe(1);
    expect(Math.round(getRemainingLockSeconds(account) / 60)).toBe(15);
  });

  test('a successful login clears every lockout field', async () => {
    Object.assign(account, {
      failedLoginAttempts: 3,
      lastFailedLoginAt: new Date(),
      lockUntil: new Date(Date.now() + MINUTE),
      lockoutCount: 2
    });

    await recordSuccessfulLogin(account._id);

    expect(account).toMatchObject({
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      lockUntil: null,
      lockoutCount: 0
    });
  });
});

describe('POST /api/auth/login with account lockout', () => {
  test('4 wrong passwords return 401, the 5th locks the account with 423', async () => {
    for (let i = 0; i < 4; i += 1) {
      const res = await login(WRONG_PASSWORD);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    }

    const res = await login(WRONG_PASSWORD);

    expect(res.status).toBe(423);
    expect(res.body.message).toMatch(/Account temporarily locked/);
    expect(res.body.message).toMatch(/15 minutes/);
    expect(res.body.retryAfterSeconds).toBe(900);
    expect(res.headers['retry-after']).toBe('900');
  });

  test('a locked account refuses even the correct password', async () => {
    account.lockUntil = new Date(Date.now() + 10 * MINUTE);

    const res = await login(GOOD_PASSWORD);

    expect(res.status).toBe(423);
    expect(res.body.token).toBeUndefined();
  });

  test('while locked, guesses are not even checked or counted', async () => {
    account.lockUntil = new Date(Date.now() + 10 * MINUTE);

    await login(WRONG_PASSWORD);

    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('after the lock expires, the correct password works and resets the counters', async () => {
    Object.assign(account, {
      lockUntil: new Date(Date.now() - 1000),
      lockoutCount: 1,
      failedLoginAttempts: 0
    });

    const res = await login(GOOD_PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(account.lockoutCount).toBe(0);
    expect(account.lockUntil).toBeNull();
  });

  test('a successful login on a clean account makes no extra database write', async () => {
    const res = await login(GOOD_PASSWORD);

    expect(res.status).toBe(200);
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  test('an unknown email gets the same vague 401 and changes nothing', async () => {
    const res = await login(WRONG_PASSWORD, 'nobody@example.com');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('lockout fields are never included in the login response', async () => {
    const res = await login(GOOD_PASSWORD);

    expect(res.body.user).toEqual({
      id: account._id,
      fullName: account.fullName,
      email: account.email,
      role: account.role
    });
  });
});
