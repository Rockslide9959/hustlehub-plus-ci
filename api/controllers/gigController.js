const { matchedData } = require('express-validator');
const Gig = require('../models/Gig');
const { isGigOwner } = require('../middleware/gigOwnership');
const { serializeGig, buildPagination } = require('../utils/gigSerializer');
const { currentUserId } = require('../utils/currentUser');

const DEFAULT_PAGE = 1; 
const DEFAULT_LIMIT = 12;

const SORTS = {
    newest: { createdAt: -1, _id: -1 },
    price_asc: { price: 1, _id: 1 },
    price_desc: { price: -1, _id: -1 }
};

const SafeText = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

//-----------------------------------------------------------------------
// Any authenticated role can browse and it will return active gigs only
//------------------------------------------------------------------------
const listGigs = async (req, res, next) => {
    try {
        const params = matchedData(req, {locations: ['query'] });
        const page = params.page || DEFAULT_PAGE;
        const limit = params.limit || DEFAULT_LIMIT;

        const filter = { isActive: true };

        if (params.category) {
            filter.category = params.category;
        }

        if (params.minPrice !== undefined || params.maxPrice !== undefined) {
            filter.price = {};

            if (params.minPrice !== undefined) filter.price.$gte = params.minPrice;
            if (params.maxPrice !== undefined) filter.price.$lte = params.maxPrice;
        }

        if (params.q) {
            const pattern = new RegExp(SafeText(params.q), 'i');
            filter.$or = [{ title: pattern }, { description: pattern }];
        }

        const [gigs, total] = await Promise.all([
            Gig.find(filter)
            .populate('freelancer', 'fullName')
            .sort(SORTS[params.sort] || SORTS.newest)
            .skip((page - 1) * limit)
            .limit(limit),
            Gig.countDocuments(filter)
        ]);

        return res.status(200).json({
        message: 'Gigs retrieved',
        data: gigs.map(serializeGig),
        pagination: buildPagination(page, limit, total)
    });
    } catch (err) {
        next(err);
    }
};

//-----------------------------------------------------------------------------------------
// My Gigs, The owner filter comes from JWT, a freelancer can only ever list their own gigs
//------------------------------------------------------------------------------------------
const listMyGigs = async (req, res, next) => {
    try {
        const params = matchedData(req, { locations: ['query'] });
        const page = params.page || DEFAULT_PAGE;
        const limit = params.limit || DEFAULT_LIMIT;

        const filter = { freelancer: currentUserId(req) };

        const [gigs, total] = await Promise.all([
        Gig.find(filter)
        .sort(SORTS.newest)
        .skip((page - 1) * limit)
        .limit(limit),
        Gig.countDocuments(filter)
    ]);

    return res.status(200).json({
        message: 'Your gigs retrieved',
        data: gigs.map(serializeGig),
        pagination: buildPagination(page, limit, total)
    });
    } catch (err) {
        next(err);
    }
};

//---------------------------------------------------------------------
// A paused gig is only visable to the owner and to the admins
//---------------------------------------------------------------------
const getGig = async (req, res, next) => {
  try {
    const gig = await Gig.findById(req.params.id).populate('freelancer', 'fullName');

    if (!gig) {
      return res.status(404).json({ message: 'Gig not found' });
    }

    // freelancer is null if the owner's account no longer exists.
    const ownerId = gig.freelancer ? gig.freelancer._id : null;
    const canSeeInactive =
      req.user.role === 'admin' || (ownerId !== null && isGigOwner({ freelancer: ownerId }, req.user));

    if (!gig.isActive && !canSeeInactive) {
      return res.status(404).json({ message: 'Gig not found' });
    }

    return res.status(200).json({
      message: 'Gig retrieved',
      data: serializeGig(gig)
    });
  } catch (err) {
    next(err);
  }
};
//------------------------------------------------------------------
// Create (freelancer only)
//------------------------------------------------------------------
const createGig = async (req, res, next) => {
  try {
    const data = matchedData(req, { locations: ['body'], includeOptionals: false });

    const gig = await Gig.create({
      title: data.title,
      description: data.description,
      price: data.price,
      category: data.category,
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      freelancer: req.user.id
    });

    return res.status(201).json({
      message: 'Gig created',
      data: serializeGig(gig)
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation failed', errors: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })) });
    }
    next(err);
  }
};
//-----------------------------------------------------------------
// Update (owning freelancer only)
//-----------------------------------------------------------------
const updateGig = async (req, res, next) => {
  try {
    const data = matchedData(req, { locations: ['body'], includeOptionals: false });

    ['title', 'description', 'price', 'category', 'isActive'].forEach((field) => {
      if (data[field] !== undefined) {
        req.gig[field] = data[field];
      }
    });

    await req.gig.save();

    return res.status(200).json({
      message: 'Gig updated',
      data: serializeGig(req.gig)
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation failed', errors: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })) });
    }
    next(err);
  }
};
//---------------------------------------------------------------------
// Delete (Freelancer or Admin)
//---------------------------------------------------------------------
const deleteGig = async (req, res, next) => {
  try {
    await req.gig.deleteOne();

    return res.status(200).json({ message: 'Gig deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listGigs,
  listMyGigs,
  getGig,
  createGig,
  updateGig,
  deleteGig
};