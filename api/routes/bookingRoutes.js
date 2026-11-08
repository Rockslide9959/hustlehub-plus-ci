const express = require('express');
const router = express.Router();
const bookingRateLimiter = require('../middleware/bookingRateLimiter')

const {
    createBooking,
    getClientBookings,
    getFreelancerBookings
} = require('../controllers/bookingController');

const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');

// Client creates a booking
router.post('/', verifyToken, authorizeRoles('client'), bookingRateLimiter, createBooking);

// Client views their own bookings
router.get('/my', verifyToken, authorizeRoles('client'), getClientBookings);

// Freelancer views bookings received
router.get('/freelancer/my', verifyToken, authorizeRoles('freelancer'), getFreelancerBookings);

module.exports = router;
