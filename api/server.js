require('dotenv').config();

const express = require('express');
const cors = require('cors');
const securityHeaders = require('./config/securityHeaders');
const corsOptions = require('./config/corsOptions');
const sanitizeInput = require('./middleware/sanitizeInput');
const { apiLimiter } = require('./middleware/rateLimiters');

const https = require('https');
const fs = require('fs');
const dns = require('dns');
const gigRoutes = require('./routes/gigRoutes');
const adminRoutes = require('./routes/adminRoutes')

// Optional DNS servers, e.g. DNS_SERVERS=8.8.8.8,8.8.4.4 in .env. Some
// Windows setups cannot resolve the MongoDB Atlas address without them.
// Kept in configuration rather than hard-coded, so each environment
// (local, Docker, CI) chooses its own resolvers.
const dnsServers = (process.env.DNS_SERVERS || '')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);
if (dnsServers.length > 0) {
  dns.setServers(dnsServers);
}

const connectDb = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// connectDb handles its own errors (it logs and exits), so the promise is
// deliberately not awaited here
void connectDb();

const app = express();
const PORT = process.env.PORT || 4000;

app.disable('x-powered-by');
// Trust the first reverse proxy (Nginx container) so req.ip reflects the real client
app.set('trust proxy', 1);

// Security headers (Helmet + Content Security Policy) on every response
app.use(securityHeaders);

// Only the React client origin may call the API from a browser
app.use(cors(corsOptions));

// Overall request limit for every /api route (stops flooding)
app.use('/api', apiLimiter);

// Parse JSON bodies, refusing anything over 10kb (stops oversized payloads)
app.use(express.json({ limit: '10kb' }));

// Block NoSQL operators and prototype pollution keys in body and query
app.use(sanitizeInput);

app.get('/', (req, res) => {
  res.send('HustleHub+ API is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/gigs', gigRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/transactions', transactionRoutes);

// 404 for unmatched routes, then safe responses for every error
app.use(notFound);
app.use(errorHandler);

// In containers and CI we run plain HTTP behind a reverse proxy (Nginx) that
// terminates TLS. Locally (outside Docker) we keep the self-signed HTTPS setup
// so the existing dev workflow and Vite proxy still work unchanged.
const useHttps = String(process.env.USE_HTTPS).toLowerCase() === 'true';

if (useHttps) {
  const keyPath = process.env.SSL_KEY_PATH;
  const certPath = process.env.SSL_CERT_PATH;

  const sslOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`HustleHub+ API running securely on https://localhost:${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`HustleHub+ API running on http://localhost:${PORT}`);
  });
}