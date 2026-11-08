const { matchedData } = require('express-validator');
const User = require('../models/User');
const Gig = require('../models/Gig');
const { serializeGig, buildPagination } = require('../utils/gigSerializer');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

//--------------------------------------------------------------------
// GET admin only. Lists accounts 
//--------------------------------------------------------------------
const listUsers = async (req, res, next) => {
  try {
    const params = matchedData(req, { locations: ['query'] });
    const page = params.page || DEFAULT_PAGE;
    const limit = params.limit || DEFAULT_LIMIT;

    const [users, total] = await Promise.all([
      User.find({})
        .select('fullName email role createdAt')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments({})
    ]);

    return res.status(200).json({
      message: 'Users retrieved',
      data: users.map((user) => ({
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      })),
      pagination: buildPagination(page, limit, total)
    });
  } catch (err) {
    next(err);
  }
};

//---------------------------------------------------------------------------------------
// GET Admin only. Lists every gig, with teh freelancer email so an admin can moderate.
//---------------------------------------------------------------------------------------
const listAllGigs = async (req, res, next) => {
    try {
        const params = matchedData(req, { locations: ['query'] });
        const page = params.page || DEFAULT_PAGE;
        const limit = params.limit || DEFAULT_LIMIT;

        const [gigs, total] = await Promise.all([
            Gig.find({})
            .populate('freelancer', 'fullName email')
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
            Gig.countDocuments({})
        ]);

       return res.status(200).json({
       message: 'All gigs retrieved',
       data: gigs.map(serializeGig),
       pagination: buildPagination(page, limit, total)
    }); 
    } catch (err) {
        next(err);
    }
};

module.exports = { listUsers, listAllGigs };