// Booking rate limiter (5 bookings per 15 minutes per client).
// The settings live with the other limiters in rateLimiters.js so every
// limiter shares the same 429 response format.
const { bookingLimiter } = require('./rateLimiters');

module.exports = bookingLimiter;
