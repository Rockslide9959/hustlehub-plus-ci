const { authenticator } = require('otplib');
const QRCode = require('qrcode');

// TOTP helpers for two-factor authentication (own security feature).
//
// TOTP (RFC 6238) is the standard used by Google Authenticator, Microsoft
// Authenticator and Authy: the server and the app share a secret, and both
// turn "secret + current time" into the same 6-digit code every 30 seconds.
// A stolen password alone is no longer enough to log in.

const ISSUER = 'HustleHub+';
const STEP_SECONDS = 30;

// window: 1 also accepts the code from the 30 seconds before or after "now",
// so a slightly slow phone clock or a code typed as it changes still works.
// A private copy is used so these settings cannot leak into other code.
const totp = authenticator.clone({ window: 1, step: STEP_SECONDS, digits: 6 });

// A new random secret: 20 bytes (160 bits, as RFC 4226 recommends), Base32
const generateTwoFactorSecret = () => totp.generateSecret(20);

// The otpauth:// link an authenticator app reads from the QR code
const buildOtpAuthUri = (email, secret) => totp.keyuri(email, ISSUER, secret);

// The QR code as a PNG data URL the frontend can show in an <img>
const buildQrCodeDataUrl = (otpAuthUri) =>
  QRCode.toDataURL(otpAuthUri, { errorCorrectionLevel: 'M', margin: 1, width: 220 });

// The 30-second time step a moment falls in
const currentTimeStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

// Checks a 6-digit code. Returns { valid, timeStep }.
//
// lastUsedStep stops replay: a code that was already accepted (or any older
// one) is refused, even if it is still inside its 30-second window.
// Any malformed input simply counts as an invalid code.
const verifyTotpCode = async (secret, code, lastUsedStep = null) => {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return { valid: false, timeStep: null };
  }

  try {
    const delta = totp.checkDelta(code, secret);
    if (delta === null) {
      return { valid: false, timeStep: null };
    }

    const timeStep = currentTimeStep() + delta;
    if (Number.isInteger(lastUsedStep) && timeStep <= lastUsedStep) {
      return { valid: false, timeStep: null };
    }

    return { valid: true, timeStep };
  } catch {
    return { valid: false, timeStep: null };
  }
};

module.exports = {
  generateTwoFactorSecret,
  buildOtpAuthUri,
  buildQrCodeDataUrl,
  verifyTotpCode
};
