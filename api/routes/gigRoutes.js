const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { loadGig, requireGigOwnership, requireGigOwnershipOrAdmin } = require('../middleware/gigOwnership');

const {
  rejectUnknownFields,
  validateCreateGig,
  validateReplaceGig,
  validatePatchGig,
  validateGigId,
  validateListQuery,
  validatePagination
} = require('../middleware/validateGigInput');

const {
    listGigs,
    listMyGigs,
    getGig,
    createGig,
    updateGig,
    deleteGig
} = require('../controllers/gigController');

const router = express.Router();

// Requires a valid JWT
router.use(verifyToken);

// Client, freelancer, admin can browse.
router.get('/', validateListQuery, listGigs);

// Freelancer owns gisg
router.get('/mine', authorizeRoles('freelancer'), validatePagination, listMyGigs);

// View one Gig
router.get('/:id', validateGigId, getGig);

// Create: freelancer only 
router.post('/', authorizeRoles('freelancer'), rejectUnknownFields, validateCreateGig, createGig);

// Update: The owning freelancer only 
router.put(
  '/:id',
  authorizeRoles('freelancer'),
  validateGigId,
  loadGig,
  requireGigOwnership,
  rejectUnknownFields,
  validateReplaceGig,
  updateGig
);

router.patch(
  '/:id',
  authorizeRoles('freelancer'),
  validateGigId,
  loadGig,
  requireGigOwnership,
  rejectUnknownFields,
  validatePatchGig,
  updateGig
);

// Delete: the owning freelancer, or an admin
router.delete('/:id', authorizeRoles('freelancer', 'admin'), validateGigId, loadGig, requireGigOwnershipOrAdmin, deleteGig);

module.exports = router;