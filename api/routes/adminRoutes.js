const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validatePagination } = require('../middleware/validateGigInput');
const { listUsers, listAllGigs } = require('../controllers/adminController');

const router = express.Router();

// Requires a valid token and admin role
router.use(verifyToken, authorizeRoles('admin'));

router.get('/users', validatePagination, listUsers);
router.get('/gigs', validatePagination, listAllGigs);

module.exports = router;
