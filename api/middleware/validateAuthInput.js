// Validation for register and login.
//
// Every error uses the same shape as the rest of the API:
//   { message: 'Readable summary', errors: [{ field, message }] }
// so the frontend can show the summary and highlight the exact field.

// summary is optional; by default the first field's message is used
const sendValidationError = (res, errors, summary) => {
    return res.status(400).json({
        message: summary || errors[0].message,
        errors
    });
};

const fieldError = (field, message) => ({ field, message });

// Email format: one "@", no spaces, and a dot in the domain (e.g.
// name@example.co.za). The part before the first dot cannot contain a dot,
// so there is only ever one way to match: the regex engine never has to
// backtrack, which keeps it fast on any input (avoids ReDoS).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

const validateRegistrationInput = (req, res, next) => {

    const { fullName, email, password, role } = req.body;

    // Check required fields (report every missing one)
    const required = { fullName, email, password, role };
    const missing = Object.keys(required).filter((field) => !required[field]);

    if (missing.length > 0) {
        return sendValidationError(res, missing.map((field) => fieldError(field, 'This field is required.')), 'Please fill in all required fields.');
    }

    // Check data types
    const notText = Object.keys(required).filter((field) => typeof required[field] !== 'string');

    if (notText.length > 0) {
        return sendValidationError(res, notText.map((field) => fieldError(field, 'Must be a text value.')), 'All fields must be text values.');
    }

    // Validate full name (80 matches the limit in the User model)
    if (fullName.trim().length < 2 || fullName.trim().length > 80) {
        return sendValidationError(res, [fieldError('fullName', 'Full name must be between 2 and 80 characters long.')]);
    }

    // Block HTML in the full name so it cannot carry a script (XSS)
    if (/[<>]/.test(fullName)) {
        return sendValidationError(res, [fieldError('fullName', 'Full name must not contain < or >.')]);
    }

    // Validate email
    if (!EMAIL_PATTERN.test(email)) {
        return sendValidationError(res, [fieldError('email', 'Please provide a valid email address.')]);
    }

    // Validate password length
    if (password.length < 8 || password.length > 72) {
        return sendValidationError(res, [fieldError('password', 'Password must be between 8 and 72 characters long.')]);
    }

    // Require uppercase letter
    if (!/[A-Z]/.test(password)) {
        return sendValidationError(res, [fieldError('password', 'Password must contain at least one uppercase letter.')]);
    }

    // Require lowercase letter
    if (!/[a-z]/.test(password)) {
        return sendValidationError(res, [fieldError('password', 'Password must contain at least one lowercase letter.')]);
    }

    // Require number
    if (!/\d/.test(password)) {
        return sendValidationError(res, [fieldError('password', 'Password must contain at least one number.')]);
    }

    // Sanitise input
    req.body = {
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        password,
        role: role.trim()
    };

    next();
};

const validateLoginInput = (req, res, next) => {
    const { email, password } = req.body;

    // Check required fields
    const required = { email, password };
    const missing = Object.keys(required).filter((field) => !required[field]);

    if (missing.length > 0) {
        return sendValidationError(res, missing.map((field) => fieldError(field, 'This field is required.')), 'Please fill in all required fields.');
    }

    // Check data types
    const notText = Object.keys(required).filter((field) => typeof required[field] !== 'string');

    if (notText.length > 0) {
        return sendValidationError(res, notText.map((field) => fieldError(field, 'Must be a text value.')), 'All fields must be text values.');
    }

    // Validate email
    if (!EMAIL_PATTERN.test(email)) {
        return sendValidationError(res, [fieldError('email', 'Please provide a valid email address.')]);
    }

    // Validate password length
    if (password.length < 8 || password.length > 72) {
        return sendValidationError(res, [fieldError('password', 'Password must be between 8 and 72 characters.')]);
    }

    // Sanitise input
    req.body = {
        email: email.toLowerCase().trim(),
        password
    };

    next();
};

module.exports = { validateRegistrationInput, validateLoginInput };
