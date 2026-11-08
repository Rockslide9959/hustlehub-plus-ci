const crypto = require('crypto');

// Encrypts secrets before they are stored in MongoDB (used for 2FA secrets).
//
// Why: the 2FA secret is what an authenticator app uses to make its codes.
// If the database leaked and the secrets were plain text, an attacker could
// generate valid codes for every user. Encrypted, they are useless without
// the key, which lives only in the server's environment (.env), never in
// the database or the code.
//
// Algorithm: AES-256-GCM (authenticated encryption).
//   - A new random 12-byte IV for every encryption, so the same secret never
//     produces the same stored value twice.
//   - A 16-byte authentication tag, so any tampering with the stored value is
//     detected and decryption fails instead of returning garbage.
//
// Stored format: v1:<iv>:<authTag>:<ciphertext>   (each part base64)

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
// The authentication tag is always the full 16 bytes. It is stated in every
// cipher call too, so Node itself rejects a shortened (truncated) tag, which
// would otherwise make forging a tampered value easier.
const AUTH_TAG_BYTES = 16;
const VERSION = 'v1';

let warnedAboutFallback = false;

// The key comes from TWO_FACTOR_ENCRYPTION_KEY (64 hex characters = 32 bytes).
// Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// If it is not set, a separate key is derived from JWT_SECRET with HKDF so the
// app still works in development and CI. A dedicated key is recommended,
// because then a leaked JWT secret does not also expose the 2FA secrets.
const getEncryptionKey = () => {
  const configured = process.env.TWO_FACTOR_ENCRYPTION_KEY;

  if (configured) {
    if (!/^[0-9a-fA-F]{64}$/.test(configured)) {
      throw new Error('TWO_FACTOR_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes).');
    }
    return Buffer.from(configured, 'hex');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('No encryption key available: set TWO_FACTOR_ENCRYPTION_KEY.');
  }

  if (!warnedAboutFallback) {
    console.warn('TWO_FACTOR_ENCRYPTION_KEY is not set; deriving the 2FA encryption key from JWT_SECRET.');
    warnedAboutFallback = true;
  }

  return Buffer.from(
    crypto.hkdfSync('sha256', jwtSecret, Buffer.alloc(0), 'hustlehub-2fa-secret-encryption', 32)
  );
};

const encryptSecret = (plainText) => {
  if (typeof plainText !== 'string' || plainText.length === 0) {
    throw new Error('Only a non-empty string can be encrypted.');
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_BYTES
  });
  const cipherText = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [VERSION, iv, authTag, cipherText]
    .map((part) => (Buffer.isBuffer(part) ? part.toString('base64') : part))
    .join(':');
};

// Throws if the value was tampered with, was encrypted with a different key,
// or is not in the expected format. Callers treat that as "2FA unavailable"
// rather than ever falling back to accepting a login.
const decryptSecret = (storedValue) => {
  const parts = typeof storedValue === 'string' ? storedValue.split(':') : [];

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Encrypted value is not in the expected format.');
  }

  const [, iv, authTag, cipherText] = parts.map((part) => Buffer.from(part, 'base64'));

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Encrypted value is not in the expected format.');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv, {
    authTagLength: AUTH_TAG_BYTES
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
};

module.exports = { encryptSecret, decryptSecret };
