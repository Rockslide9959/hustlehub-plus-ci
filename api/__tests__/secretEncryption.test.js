const { authenticator } = require('otplib');
const { encryptSecret, decryptSecret } = require('../utils/secretEncryption');

// Own security feature (part of 2FA): 2FA secrets are encrypted at rest
// with AES-256-GCM, so a leaked database does not leak working 2FA secrets.

// A fresh random 2FA secret for every run, so no secret-looking value is
// hard-coded in the repository (and secret scanners stay quiet)
const SECRET = authenticator.generateSecret(20);
const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

beforeAll(() => {
  process.env.JWT_SECRET = 'jest-only-secret-not-for-production';
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

beforeEach(() => {
  process.env.TWO_FACTOR_ENCRYPTION_KEY = KEY_A;
});

afterAll(() => {
  delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
  console.warn.mockRestore();
});

describe('2FA secret encryption (AES-256-GCM)', () => {
  test('encrypts and decrypts back to the original secret', () => {
    expect(decryptSecret(encryptSecret(SECRET))).toBe(SECRET);
  });

  test('the stored value never contains the plain secret', () => {
    const stored = encryptSecret(SECRET);
    expect(stored).not.toContain(SECRET);
    expect(stored.startsWith('v1:')).toBe(true);
  });

  test('encrypting the same secret twice gives different values (random IV)', () => {
    expect(encryptSecret(SECRET)).not.toBe(encryptSecret(SECRET));
  });

  test('a tampered value is rejected instead of decrypting', () => {
    const [version, iv, tag, cipherText] = encryptSecret(SECRET).split(':');
    const bytes = Buffer.from(cipherText, 'base64');
    bytes[0] ^= 0xff;
    const tampered = [version, iv, tag, bytes.toString('base64')].join(':');

    expect(() => decryptSecret(tampered)).toThrow();
  });

  test('a value encrypted with a different key cannot be decrypted', () => {
    const stored = encryptSecret(SECRET);
    process.env.TWO_FACTOR_ENCRYPTION_KEY = KEY_B;

    expect(() => decryptSecret(stored)).toThrow();
  });

  test('values in the wrong format are rejected', () => {
    expect(() => decryptSecret('not-encrypted')).toThrow('expected format');
    expect(() => decryptSecret(null)).toThrow('expected format');
    expect(() => decryptSecret(`v2:${encryptSecret(SECRET).slice(3)}`)).toThrow('expected format');
  });

  test('an invalid key in .env is refused', () => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = 'too-short';
    expect(() => encryptSecret(SECRET)).toThrow('64 hexadecimal characters');
  });

  test('without a dedicated key, a key derived from JWT_SECRET still works', () => {
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
    expect(decryptSecret(encryptSecret(SECRET))).toBe(SECRET);
  });

  test('empty values cannot be encrypted', () => {
    expect(() => encryptSecret('')).toThrow();
    expect(() => encryptSecret(undefined)).toThrow();
  });
});
