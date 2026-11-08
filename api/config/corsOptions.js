// CORS (Cross-Origin Resource Sharing) settings.
//
// Browsers block a web page from calling an API on a different origin unless
// the API says that origin is allowed. Only the HustleHub+ React app is
// allowed, so a malicious site cannot use a logged-in user's browser to
// call the API.
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const corsOptions = {
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // The JWT is sent in the Authorization header, not in cookies
  credentials: false,
  // Let the browser cache the preflight check for 10 minutes
  maxAge: 600
};

module.exports = corsOptions;
