const jwt = require('jsonwebtoken');
const { readTwoFactorChallenge } = require('../utils/twoFactorChallenge');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Only accept tokens signed with HS256 by this API for the HustleHub+ client.
    // Pinning the algorithm stops attacks that swap it (e.g. to "none").
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'hustlehub-api',
      audience: 'hustlehub-client'
    });

    // Guards against malformed/old tokens
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    req.user = decoded;
    next();
  } catch {
    // Covers both expired tokens and tampered/invalid signatures. The reason
    // is deliberately not sent back, so the response gives nothing away.
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// For login step 2 only: accepts the 5-minute 2FA challenge token (never a
// normal login token) and puts the user's id on req.user, so the 2FA rate
// limiter can count wrong codes per account.
const verifyTwoFactorChallenge = (req, res, next) => {
  const userId = readTwoFactorChallenge(req.body.challengeToken);

  if (!userId) {
    return res.status(401).json({ message: 'Your login session has expired. Please log in again.' });
  }

  req.user = { id: userId };
  next();
};

module.exports = { verifyToken, verifyTwoFactorChallenge };