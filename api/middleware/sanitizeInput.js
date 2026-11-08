// Input sanitiser for every request.
//
// Blocks two kinds of attack before the request reaches any route:
//
// 1. NoSQL injection: MongoDB treats keys that start with "$" as operators.
//    A login body like { "email": { "$ne": null } } could match any user if
//    it reached a query. Keys containing "." can also reach into nested
//    fields, so they are blocked too.
//
// 2. Prototype pollution: keys such as "__proto__" or "constructor" can change
//    the behaviour of every object in the app if they get merged in.
//
// express-mongo-sanitize is not used because it tries to overwrite req.query,
// which is read-only in Express 5 and crashes the app.

const BLOCKED_KEYS = ['__proto__', 'constructor', 'prototype'];

// Deeply nested JSON is never needed by this API and can be used to
// slow the server down, so anything deeper than this is rejected.
const MAX_DEPTH = 5;

// Any "$" is blocked (not just a leading one) so URL tricks such as
// ?price[$gt]=0 are caught as well
const isUnsafeKey = (key) =>
  key.includes('$') || key.includes('.') || BLOCKED_KEYS.includes(key);

// Returns a description of the first problem found, or null if the value is safe
const findProblem = (value, path, depth) => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  if (depth > MAX_DEPTH) {
    return { field: path || 'body', message: 'Request data is nested too deeply' };
  }

  for (const key of Object.keys(value)) {
    const fieldPath = path ? `${path}.${key}` : key;

    if (isUnsafeKey(key)) {
      return { field: fieldPath, message: 'Field name contains characters that are not allowed' };
    }

    const problem = findProblem(value[key], fieldPath, depth + 1);
    if (problem) {
      return problem;
    }
  }

  return null;
};

const sanitizeInput = (req, res, next) => {
  const problem =
    findProblem(req.body, '', 0) ||
    findProblem(req.query, '', 0);

  if (problem) {
    // Server-side record of the blocked request (never sent to the client)
    console.warn(`Blocked unsafe input on ${req.method} ${req.originalUrl}: ${problem.field}`);

    return res.status(400).json({
      message: 'Request contains data that is not allowed',
      errors: [problem]
    });
  }

  next();
};

module.exports = sanitizeInput;
