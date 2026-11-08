const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');

// Own security feature: two-factor authentication (TOTP).
// No real MongoDB is needed: the User model is replaced by a small fake that
// keeps one account in memory. Real codes are generated with otplib, exactly
// as an authenticator app would.

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

// Supports both `await User.findById(id)` and `await User.findById(id).select(...)`
const findResult = (found) => {
  const copy = found ? { ...account } : null;
  const query = Promise.resolve(copy);
  query.select = () => Promise.resolve(copy);
  return query;
};

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  updateOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

// Rate limiters are tested elsewhere; keep them out of the way here
jest.mock('../middleware/rateLimiters', () => ({
  loginLimiter: (req, res, next) => next(),
  registerLimiter: (req, res, next) => next(),
  twoFactorLimiter: (req, res, next) => next()
}));

const User = require('../models/User');
const { verifyTotpCode, buildOtpAuthUri } = require('../utils/twoFactor');
const { encryptSecret, decryptSecret } = require('../utils/secretEncryption');
const { createTwoFactorChallenge, readTwoFactorChallenge } = require('../utils/twoFactorChallenge');
const authRoutes = require('../routes/authRoutes');
const { errorHandler } = require('../middleware/errorHandler');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

const EMAIL = 'twofactor.test@example.com';
const PASSWORD = 'GoodPass123';
const SECRET = authenticator.generateSecret(20);

let passwordHash;

const loginToken = (id = 'user-1') =>
  jwt.sign({ id, role: 'client' }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
    issuer: 'hustlehub-api',
    audience: 'hustlehub-client'
  });

const asUser = (method, path, body) =>
  request(app)[method](`/api/auth${path}`)
    .set('Authorization', `Bearer ${loginToken()}`)
    .send(body);

const currentCode = (secret = SECRET) => authenticator.generate(secret);

// A different, valid code: the one from the previous 30-second window
const previousCode = (secret = SECRET) => {
  const totp = authenticator.clone({ epoch: Date.now() - 30 * 1000 });
  return totp.generate(secret);
};

const enableTwoFactorOnAccount = () => {
  Object.assign(account, {
    twoFactorEnabled: true,
    twoFactorSecret: encryptSecret(SECRET),
    twoFactorLastUsedStep: null
  });
};

beforeAll(async () => {
  process.env.JWT_SECRET = 'jest-only-secret-not-for-production';
  process.env.TWO_FACTOR_ENCRYPTION_KEY = 'c'.repeat(64);
  passwordHash = await bcrypt.hash(PASSWORD, 4);
});

afterAll(() => {
  delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
});

beforeEach(() => {
  account = {
    _id: 'user-1',
    fullName: 'Two Factor Tester',
    email: EMAIL,
    role: 'client',
    passwordHash,
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lockUntil: null,
    lockoutCount: 0,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorPendingSecret: null,
    twoFactorLastUsedStep: null
  };

  User.findById.mockImplementation((id) => findResult(String(id) === account._id));
  User.findOne.mockImplementation((filter) => findResult(filter.email === account.email));
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
});

describe('TOTP code checking', () => {
  test('accepts the current code and returns its time step', async () => {
    const result = await verifyTotpCode(SECRET, currentCode());
    expect(result.valid).toBe(true);
    expect(Number.isInteger(result.timeStep)).toBe(true);
  });

  test('accepts the code from the previous 30 seconds (clock tolerance)', async () => {
    expect((await verifyTotpCode(SECRET, previousCode())).valid).toBe(true);
  });

  test('rejects a wrong code', async () => {
    const wrong = currentCode() === '000000' ? '111111' : '000000';
    expect((await verifyTotpCode(SECRET, wrong)).valid).toBe(false);
  });

  test('rejects a code that was already used (replay protection)', async () => {
    const first = await verifyTotpCode(SECRET, currentCode());
    const replay = await verifyTotpCode(SECRET, currentCode(), first.timeStep);
    expect(replay.valid).toBe(false);
  });

  test('treats malformed input as an invalid code instead of throwing', async () => {
    for (const bad of ['12345', '1234567', 'abcdef', '', null, undefined, 123456, { $ne: '' }]) {
      expect((await verifyTotpCode(SECRET, bad)).valid).toBe(false);
    }
  });

  test('builds the otpauth link authenticator apps scan', () => {
    const uri = buildOtpAuthUri(EMAIL, SECRET);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(`secret=${SECRET}`);
    expect(uri).toContain('issuer=HustleHub%2B');
  });
});

describe('2FA challenge token (login step 1 -> step 2)', () => {
  test('a challenge token reads back to the user id', () => {
    expect(readTwoFactorChallenge(createTwoFactorChallenge(account))).toBe('user-1');
  });

  test('a normal login token is NOT accepted as a challenge token', () => {
    expect(readTwoFactorChallenge(loginToken())).toBeNull();
  });

  test('a challenge token is NOT accepted as a normal login token', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${createTwoFactorChallenge(account)}`);
    expect(res.status).toBe(401);
  });

  test('tampered or garbage tokens are rejected', () => {
    const token = createTwoFactorChallenge(account);
    expect(readTwoFactorChallenge(`${token.slice(0, -2)}xx`)).toBeNull();
    expect(readTwoFactorChallenge('not-a-token')).toBeNull();
  });
});

describe('turning 2FA on and off', () => {
  test('every 2FA settings route requires a login token', async () => {
    const res = await request(app).post('/api/auth/2fa/setup');
    expect(res.status).toBe(401);
  });

  test('status starts as off', async () => {
    const res = await asUser('get', '/2fa/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false });
  });

  test('setup returns a QR code and stores the secret encrypted as pending', async () => {
    const res = await asUser('post', '/2fa/setup');

    expect(res.status).toBe(200);
    expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(res.body.manualEntryKey).toMatch(/^[A-Z2-7]{32}$/);

    // Stored encrypted, never in plain text, and not active yet
    expect(account.twoFactorPendingSecret).not.toContain(res.body.manualEntryKey);
    expect(decryptSecret(account.twoFactorPendingSecret)).toBe(res.body.manualEntryKey);
    expect(account.twoFactorEnabled).toBe(false);
  });

  test('enable refuses a wrong code and keeps 2FA off', async () => {
    await asUser('post', '/2fa/setup');

    const res = await asUser('post', '/2fa/enable', { code: '000000' });

    expect(res.status).toBe(400);
    expect(account.twoFactorEnabled).toBe(false);
  });

  test('enable with a correct code turns 2FA on', async () => {
    const setup = await asUser('post', '/2fa/setup');
    const code = currentCode(setup.body.manualEntryKey);

    const res = await asUser('post', '/2fa/enable', { code });

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(account.twoFactorEnabled).toBe(true);
    expect(account.twoFactorPendingSecret).toBeNull();
    expect(decryptSecret(account.twoFactorSecret)).toBe(setup.body.manualEntryKey);
  });

  test('enable before setup is refused', async () => {
    const res = await asUser('post', '/2fa/enable', { code: '123456' });
    expect(res.status).toBe(400);
  });

  test('enable rejects codes that are not 6 digits', async () => {
    const res = await asUser('post', '/2fa/enable', { code: '12ab56' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('code');
  });

  test('setup is refused while 2FA is already on', async () => {
    enableTwoFactorOnAccount();
    const res = await asUser('post', '/2fa/setup');
    expect(res.status).toBe(409);
  });

  test('disable needs the correct password', async () => {
    enableTwoFactorOnAccount();

    const res = await asUser('post', '/2fa/disable', { password: 'WrongPass123', code: currentCode() });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Incorrect password or code.');
    expect(account.twoFactorEnabled).toBe(true);
  });

  test('disable needs a valid code', async () => {
    enableTwoFactorOnAccount();
    const wrong = currentCode() === '000000' ? '111111' : '000000';

    const res = await asUser('post', '/2fa/disable', { password: PASSWORD, code: wrong });

    expect(res.status).toBe(400);
    expect(account.twoFactorEnabled).toBe(true);
  });

  test('disable with password and code turns 2FA off and deletes the secret', async () => {
    enableTwoFactorOnAccount();

    const res = await asUser('post', '/2fa/disable', { password: PASSWORD, code: currentCode() });

    expect(res.status).toBe(200);
    expect(account.twoFactorEnabled).toBe(false);
    expect(account.twoFactorSecret).toBeNull();
  });
});

describe('logging in with 2FA', () => {
  const loginWithPassword = () =>
    request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });

  const verify = (challengeToken, code) =>
    request(app).post('/api/auth/2fa/verify').send({ challengeToken, code });

  test('without 2FA, the password alone still logs in (unchanged)', async () => {
    const res = await loginWithPassword();
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('with 2FA, the password returns a challenge token and NO login token', async () => {
    enableTwoFactorOnAccount();

    const res = await loginWithPassword();

    expect(res.status).toBe(200);
    expect(res.body.twoFactorRequired).toBe(true);
    expect(res.body.challengeToken).toBeDefined();
    expect(res.body.token).toBeUndefined();
  });

  test('challenge token + correct code returns a working login token', async () => {
    enableTwoFactorOnAccount();
    const { body } = await loginWithPassword();

    const res = await verify(body.challengeToken, currentCode());

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(EMAIL);
    const profile = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(profile.status).toBe(200);
  });

  test('a wrong code is refused and counted towards the account lockout', async () => {
    enableTwoFactorOnAccount();
    const { body } = await loginWithPassword();
    const wrong = currentCode() === '000000' ? '111111' : '000000';

    const res = await verify(body.challengeToken, wrong);

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
    expect(account.failedLoginAttempts).toBe(1);
  });

  test('the same code cannot be used twice', async () => {
    enableTwoFactorOnAccount();
    const { body } = await loginWithPassword();
    const code = currentCode();

    expect((await verify(body.challengeToken, code)).status).toBe(200);
    expect((await verify(body.challengeToken, code)).status).toBe(401);
  });

  test('5 wrong codes lock the account', async () => {
    enableTwoFactorOnAccount();
    const { body } = await loginWithPassword();
    const wrong = currentCode() === '000000' ? '111111' : '000000';

    let res;
    for (let i = 0; i < 5; i += 1) {
      res = await verify(body.challengeToken, wrong);
    }

    expect(res.status).toBe(423);
    expect((await loginWithPassword()).status).toBe(423);
  });

  test('a correct password does not reset failed code attempts', async () => {
    enableTwoFactorOnAccount();
    account.failedLoginAttempts = 3;
    account.lastFailedLoginAt = new Date();

    await loginWithPassword();

    expect(account.failedLoginAttempts).toBe(3);
  });

  test('verify refuses a missing, invalid or normal login token', async () => {
    enableTwoFactorOnAccount();

    expect((await verify(undefined, currentCode())).status).toBe(400);
    expect((await verify('not-a-token', currentCode())).status).toBe(401);
    expect((await verify(loginToken(), currentCode())).status).toBe(401);
  });
});
