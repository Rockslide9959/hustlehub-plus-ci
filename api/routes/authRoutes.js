const express = require('express');
const { verifyToken, verifyTwoFactorChallenge } = require('../middleware/authMiddleware');
const { registerUser, loginUser, verifyTwoFactorLogin } = require('../controllers/authController');
const { validateRegistrationInput, validateLoginInput } = require('../middleware/validateAuthInput');
const { loginLimiter, registerLimiter, twoFactorLimiter } = require('../middleware/rateLimiters');
const {
  validateTwoFactorCode,
  validateTwoFactorDisable,
  validateTwoFactorLogin
} = require('../middleware/validateTwoFactorInput');
const {
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor
} = require('../controllers/twoFactorController');

const router = express.Router();

router.post('/login', loginLimiter, validateLoginInput, loginUser);

router.post('/register', registerLimiter, validateRegistrationInput, registerUser);

router.get('/profile', verifyToken, (req, res) => {
  res.status(200).json({
    message: 'This is a protected route',
    user: req.user,
  });
});

// Two-factor authentication (own security feature).
// All require a valid JWT: users can only manage their own 2FA.
router.get('/2fa/status', verifyToken, getTwoFactorStatus);
router.post('/2fa/setup', verifyToken, setupTwoFactor);
router.post('/2fa/enable', verifyToken, twoFactorLimiter, validateTwoFactorCode, enableTwoFactor);
router.post('/2fa/disable', verifyToken, twoFactorLimiter, validateTwoFactorDisable, disableTwoFactor);

// Login step 2: swap the challenge token + a valid code for the real JWT
router.post('/2fa/verify', validateTwoFactorLogin, verifyTwoFactorChallenge, twoFactorLimiter, verifyTwoFactorLogin);

module.exports = router;