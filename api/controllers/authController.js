const { hashPassword, comparePassword } = require('../utils/hash');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const {
  getRemainingLockSeconds,
  recordFailedLogin,
  recordSuccessfulLogin,
  LOCKOUT_FIELDS
} = require('../utils/accountLockout');
const { decryptSecret } = require('../utils/secretEncryption');
const { verifyTotpCode } = require('../utils/twoFactor');
const { createTwoFactorChallenge } = require('../utils/twoFactorChallenge');

// 423 Locked response for a temporarily locked account.
// Retry-After tells programs (and our frontend) exactly when to try again.
const sendAccountLocked = (res, retryAfterSeconds) => {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  res.set('Retry-After', String(retryAfterSeconds));
  return res.status(423).json({
    message: `Account temporarily locked after too many failed login attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    retryAfterSeconds
  });
};

// REGISTER USER
const registerUser = async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body;

    // Normalize role
    const normalizedRole = role.toLowerCase().trim();

    // Public registration can ONLY create these roles
    const allowedRoles = ['client', 'freelancer'];

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        message: 'Role must be either client or freelancer.',
        errors: [{ field: 'role', message: 'Role must be either client or freelancer.' }]
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      logger.warn('registration_failed', {
        event: 'registration',
        outcome: 'duplicate_email',
        email: normalizedEmail,
        ip: req.ip,
      });
      return res.status(409).json({
        message: 'User already exists.'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      passwordHash,
      role: normalizedRole
    });

    logger.info('user_registered', {
      event: 'registration',
      outcome: 'success',
      userId: user._id.toString(),
      role: user.role,
      email: normalizedEmail,
      ip: req.ip,
    });

    return res.status(201).json({
      message: 'User registered',
      data: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    // Mongoose validation and duplicate email errors are turned into safe
    // messages by the central error handler (no database details leak)
    next(err);
  }
};


// Signs the normal login JWT and sends the successful login response.
// Used by both password login and the 2FA verify step, so a login always
// ends with exactly the same token and response shape.
const sendLoginSuccess = (res, user) => {
  const token = jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      issuer: 'hustlehub-api',
      audience: 'hustlehub-client'
    }
  );

  return res.status(200).json({
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role
    }
  });
};


// LOGIN USER
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    // Find user in MongoDB (with the hidden password hash and lockout fields)
    const user = await User.findOne({
      email: email
    }).select(`+passwordHash ${LOCKOUT_FIELDS}`);

    // Keep this deliberately vague to the client, but log precisely on the server
    if (!user) {
      logger.warn('login_failed', {
        event: 'login_attempt',
        outcome: 'user_not_found',
        email,
        ip,
        userAgent,
      });
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // Account lockout: refuse a locked account BEFORE checking the password,
    // so an attacker cannot keep guessing while the lock is active
    const lockedForSeconds = getRemainingLockSeconds(user);
    if (lockedForSeconds > 0) {
      logger.warn('login_blocked', {
        event: 'login_attempt',
        outcome: 'account_locked',
        userId: user._id.toString(),
        email,
        ip,
        userAgent,
      });
      return sendAccountLocked(res, lockedForSeconds);
    }

    // Compare supplied password with stored hash
    const isMatch = await comparePassword(
      password,
      user.passwordHash
    );

    if (!isMatch) {
      logger.warn('login_failed', {
        event: 'login_attempt',
        outcome: 'bad_password',
        userId: user._id.toString(),
        email,
        ip,
        userAgent,
      });

      // Count the failure on the account; lock it when the limit is reached
      const lockout = await recordFailedLogin(user._id);

      if (lockout.locked) {
        logger.warn('account_locked', {
          event: 'account_lockout',
          outcome: 'locked',
          userId: user._id.toString(),
          email,
          ip,
          userAgent,
          lockSeconds: lockout.retryAfterSeconds,
        });
        return sendAccountLocked(res, lockout.retryAfterSeconds);
      }

      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    // Two-factor authentication: the password alone is not enough.
    // Return a 5-minute challenge token instead of a login token. Failure
    // counters are deliberately NOT cleared here, so knowing the password
    // does not reset the lockout an attacker is building up on the code.
    if (user.twoFactorEnabled) {
      logger.info('login_2fa_required', {
        event: 'login_attempt',
        outcome: 'password_ok_2fa_required',
        userId: user._id.toString(),
        email,
        ip,
        userAgent,
      });
      return res.status(200).json({
        message: 'Enter the 6-digit code from your authenticator app.',
        twoFactorRequired: true,
        challengeToken: createTwoFactorChallenge(user)
      });
    }

    // Correct password: clear any earlier failures (skip the write if clean)
    if (user.failedLoginAttempts || user.lockUntil || user.lockoutCount) {
      await recordSuccessfulLogin(user._id);
    }

    logger.info('login_success', {
      event: 'login_attempt',
      outcome: 'success',
      userId: user._id.toString(),
      role: user.role,
      email,
      ip,
      userAgent,
    });

    return sendLoginSuccess(res, user);

  } catch (err) {
    next(err);
  }
};


// LOGIN STEP 2 (accounts with 2FA on)
// POST /api/auth/2fa/verify { challengeToken, code }
// The challenge token has already been checked by verifyTwoFactorChallenge,
// which puts the user's id on req.user.
const verifyTwoFactorLogin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      `${LOCKOUT_FIELDS} +twoFactorSecret +twoFactorLastUsedStep`
    );

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(401).json({ message: 'Your login session has expired. Please log in again.' });
    }

    // The lockout covers wrong codes as well as wrong passwords
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    const logDetails = { userId: user._id.toString(), email: user.email, ip, userAgent };

    const lockedForSeconds = getRemainingLockSeconds(user);
    if (lockedForSeconds > 0) {
      logger.warn('login_blocked', { event: 'login_2fa', outcome: 'account_locked', ...logDetails });
      return sendAccountLocked(res, lockedForSeconds);
    }

    const result = await verifyTotpCode(
      decryptSecret(user.twoFactorSecret),
      req.body.code,
      user.twoFactorLastUsedStep
    );

    if (!result.valid) {
      logger.warn('login_failed', { event: 'login_2fa', outcome: 'bad_2fa_code', ...logDetails });
      const lockout = await recordFailedLogin(user._id);

      if (lockout.locked) {
        logger.warn('account_locked', {
          event: 'account_lockout',
          outcome: 'locked',
          lockSeconds: lockout.retryAfterSeconds,
          ...logDetails
        });
        return sendAccountLocked(res, lockout.retryAfterSeconds);
      }

      return res.status(401).json({
        message: 'That code is not valid. Check your authenticator app and try again.',
        errors: [{ field: 'code', message: 'That code is not valid.' }]
      });
    }

    // Both factors passed: remember the code so it cannot be replayed,
    // clear the failure counters and log the user in
    await User.updateOne(
      { _id: user._id },
      { $set: { twoFactorLastUsedStep: result.timeStep } }
    );
    if (user.failedLoginAttempts || user.lockUntil || user.lockoutCount) {
      await recordSuccessfulLogin(user._id);
    }

    logger.info('login_success', { event: 'login_2fa', outcome: 'success', role: user.role, ...logDetails });

    return sendLoginSuccess(res, user);

  } catch (err) {
    next(err);
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyTwoFactorLogin
};
