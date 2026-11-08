const User = require('../models/User');
const { comparePassword } = require('../utils/hash');
const { encryptSecret, decryptSecret } = require('../utils/secretEncryption');
const {
  generateTwoFactorSecret,
  buildOtpAuthUri,
  buildQrCodeDataUrl,
  verifyTotpCode
} = require('../utils/twoFactor');

// Two-factor authentication management for the logged-in user.
// Every route here runs after verifyToken, so req.user.id is the caller and
// a user can only ever change their own 2FA settings.

const TWO_FACTOR_FIELDS = '+twoFactorSecret +twoFactorPendingSecret +twoFactorLastUsedStep';

const invalidCode = (res) =>
  res.status(400).json({
    message: 'That code is not valid. Check your authenticator app and try again.',
    errors: [{ field: 'code', message: 'That code is not valid.' }]
  });

// GET /api/auth/2fa/status -> { enabled }
const getTwoFactorStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.status(200).json({ enabled: Boolean(user.twoFactorEnabled) });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/2fa/setup
// Step 1 of turning 2FA on: makes a new secret and returns it as a QR code.
// The secret is only saved as "pending" until the user proves their app
// works (step 2), so a half-finished setup can never lock anyone out.
const setupTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.twoFactorEnabled) {
      return res.status(409).json({ message: 'Two-factor authentication is already turned on.' });
    }

    const secret = generateTwoFactorSecret();
    const otpAuthUri = buildOtpAuthUri(user.email, secret);
    const qrCode = await buildQrCodeDataUrl(otpAuthUri);

    await User.updateOne(
      { _id: user._id },
      { $set: { twoFactorPendingSecret: encryptSecret(secret) } }
    );

    // The secret is shown to its owner once, for typing in by hand if the
    // QR code cannot be scanned. It is never returned by any other route.
    return res.status(200).json({
      message: 'Scan the QR code with your authenticator app, then enter the 6-digit code to finish.',
      qrCode,
      manualEntryKey: secret
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/2fa/enable { code }
// Step 2: a correct code from the app proves the setup worked, so the
// pending secret becomes the real one and 2FA is switched on.
const enableTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(TWO_FACTOR_FIELDS);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.twoFactorEnabled) {
      return res.status(409).json({ message: 'Two-factor authentication is already turned on.' });
    }

    if (!user.twoFactorPendingSecret) {
      return res.status(400).json({ message: 'Start the setup first to get a QR code.' });
    }

    const secret = decryptSecret(user.twoFactorPendingSecret);
    const result = await verifyTotpCode(secret, req.body.code);

    if (!result.valid) {
      return invalidCode(res);
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          twoFactorEnabled: true,
          twoFactorSecret: user.twoFactorPendingSecret,
          twoFactorPendingSecret: null,
          twoFactorLastUsedStep: result.timeStep
        }
      }
    );

    return res.status(200).json({ message: 'Two-factor authentication is now on.', enabled: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/2fa/disable { password, code }
// Needs BOTH the password and a current code, so someone who finds an
// unlocked, logged-in session cannot quietly switch the protection off.
const disableTwoFactor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(`+passwordHash ${TWO_FACTOR_FIELDS}`);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: 'Two-factor authentication is not turned on.' });
    }

    const passwordOk = await comparePassword(req.body.password, user.passwordHash);
    const result = await verifyTotpCode(
      decryptSecret(user.twoFactorSecret),
      req.body.code,
      user.twoFactorLastUsedStep
    );

    // One vague message, so the response does not reveal which part was wrong.
    // 400 (not 401): the session itself is fine, only the form input is wrong,
    // so the frontend must not treat this as an expired login.
    if (!passwordOk || !result.valid) {
      return res.status(400).json({ message: 'Incorrect password or code.' });
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorPendingSecret: null,
          twoFactorLastUsedStep: null
        }
      }
    );

    return res.status(200).json({ message: 'Two-factor authentication is now off.', enabled: false });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor
};
