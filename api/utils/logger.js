// Centralised logger for the HustleHub+ API.
//
// Emits structured JSON to stdout (captured by Docker and by Grafana Agent in
// production) AND, when LOKI_URL is set, ships every log line to Grafana Cloud
// Loki for cloud-based querying and dashboarding.
//
// Why both: stdout is the always-on, no-network fallback; Loki is what the
// README and evidence screenshots will show.

const winston = require('winston');
const LokiTransport = require('winston-loki');

const APP_NAME = process.env.APP_NAME || 'hustlehub-api';
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Redact secrets and PII before they reach any transport.
// Winston calls this for every log; it runs on the metadata object only,
// never on the base message.
const redactSensitive = winston.format((info) => {
  const redactedKeys = ['password', 'token', 'jwt', 'authorization', 'cookie', 'secret'];
  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (redactedKeys.some((k) => key.toLowerCase().includes(k))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        walk(obj[key]);
      }
    }
  };
  walk(info);
  return info;
});

const baseFormat = winston.format.combine(
  winston.format.timestamp(),
  redactSensitive(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: baseFormat,
  }),
];

// Only attach the Loki transport when fully configured, so local dev and CI
// don't log noisy "ECONNREFUSED" errors when Loki isn't reachable.
if (process.env.LOKI_URL && process.env.LOKI_USER && process.env.LOKI_API_KEY) {
  transports.push(
    new LokiTransport({
      host: process.env.LOKI_URL,
      basicAuth: `${process.env.LOKI_USER}:${process.env.LOKI_API_KEY}`,
      labels: { app: APP_NAME, env: NODE_ENV },
      json: true,
      format: baseFormat,
      replaceTimestamp: true,
      onConnectionError: (err) => {
        // Don't crash the API if Loki is briefly unreachable
        console.error('[logger] Loki transport error:', err.message);
      },
    })
  );
}

const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: { app: APP_NAME, env: NODE_ENV },
  transports,
});

module.exports = logger;