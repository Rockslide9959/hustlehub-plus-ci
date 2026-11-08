const Gig = require('../models/Gig');

// Middleware to check if the authenticated user is the owner of the gig
const isGigOwner = (gig, user) => String(gig.freelancer) === String(user.id);

// Middleware to load a gig by ID and attach it to the request object
const loadGig = async (req, res, next) => {
    try {
        const gig = await Gig.findById(req.params.id);
        if (!gig) {
            return res.status(404).json({ message: 'Gig not found' });
        }

        req.gig = gig; // Attach the gig to the request object for further use
        next();
        } catch (err) {
            next(err);
        }
};

// Only the freelancer who created the gig can continue
const requireGigOwnership = (req, res, next) => {
    if (!isGigOwner(req.gig, req.user)) {
        return res.status(403).json({ message: 'Access denied: You do not own this gig' });
    }
    next();
};

// The owner or an admin can continue
const requireGigOwnershipOrAdmin = (req, res, next) => {
    if (req.user.role === 'admin' || isGigOwner(req.gig, req.user)) {
        return next();
    }
    return res.status(403).json({ message: 'Access denied: You do not own this gig' });
};

module.exports = {
    loadGig,
    requireGigOwnership,
    requireGigOwnershipOrAdmin,
    isGigOwner
};