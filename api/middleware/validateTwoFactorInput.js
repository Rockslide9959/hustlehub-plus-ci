// Validation for the two-factor authentication routes.
// Same error shape as the rest of the API: { message, errors: [{ field, message }] }

const fieldError = (field, message) => ({ field, message });

const sendValidationError = (res, errors) =>
  res.status(400).json({ message: errors[0].message, errors });

// A TOTP code is exactly 6 digits. Spaces are allowed and removed, because
// authenticator apps often display codes as "123 456".
const readCode = (value) => (typeof value === 'string' ? value.replace(/\s/g, '') : null);

const validateTwoFactorCode = (req, res, next) => {
  const code = readCode(req.body?.code);

  if (!code) {
    return sendValidationError(res, [fieldError('code', 'The 6-digit code is required.')]);
  }

  if (!/^\d{6}$/.test(code)) {
    return sendValidationError(res, [fieldError('code', 'The code must be exactly 6 digits.')]);
  }

  // Only keep the field this route needs
  req.body = { code };
  next();
};

// Turning 2FA off needs the password as well as a current code
const validateTwoFactorDisable = (req, res, next) => {
  const { password } = req.body || {};
  const code = readCode(req.body?.code);
  const errors = [];

  if (typeof password !== 'string' || password.length === 0) {
    errors.push(fieldError('password', 'Your password is required.'));
  } else if (password.length > 72) {
    errors.push(fieldError('password', 'Password must not exceed 72 characters.'));
  }

  if (!code) {
    errors.push(fieldError('code', 'The 6-digit code is required.'));
  } else if (!/^\d{6}$/.test(code)) {
    errors.push(fieldError('code', 'The code must be exactly 6 digits.'));
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  req.body = { password, code };
  next();
};

// Login step 2: the challenge token from step 1 plus a 6-digit code
const validateTwoFactorLogin = (req, res, next) => {
  const { challengeToken } = req.body || {};
  const code = readCode(req.body?.code);
  const errors = [];

  // A JWT is a few hundred characters; anything far bigger is not one
  if (typeof challengeToken !== 'string' || challengeToken.length === 0 || challengeToken.length > 2000) {
    errors.push(fieldError('challengeToken', 'Your login session has expired. Please log in again.'));
  }

  if (!code) {
    errors.push(fieldError('code', 'The 6-digit code is required.'));
  } else if (!/^\d{6}$/.test(code)) {
    errors.push(fieldError('code', 'The code must be exactly 6 digits.'));
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  req.body = { challengeToken, code };
  next();
};

module.exports = { validateTwoFactorCode, validateTwoFactorDisable, validateTwoFactorLogin };
