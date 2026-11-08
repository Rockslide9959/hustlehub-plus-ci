const { body, param, query, validationResult } = require('express-validator');
const { GIG_CATEGORIES } = require('../models/Gig');

// the only fields a client can send to create or update a gig
const ALLOWED_FIELDS = ['title', 'description', 'price', 'category', 'isActive'];

const SORT_OPTIONS = ['newest', 'price_asc', 'price_desc'];

const handleValidation = (req, res, next) => {
    const result = validationResult(req);

    if (!result.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: result.array({ onlyFirstError: true }).map((e) => ({
        field: e.path,
        message: e.msg
      }))
    });
  }

  next();
};

// Rejects bodies that are not a JSON object and fields outside the allowed lists
const rejectUnknownFields = (req, res, next) => {
    if (req.body === undefined) {
        req.body = {};
    }

    if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ message: 'Request body must be a JSON object'});
    }

    const unknown = Object.keys(req.body).filter((key) => !ALLOWED_FIELDS.includes(key));

    if (unknown.length > 0) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: unknown.map((field) => ({ field, message: 'Field is not allowed'}))
        });
    }
    next();
}

const requireAtLeastOneField = (req, res, next) => {
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: 'Provide one field to update'});
    }
    next();
};

// Not mark up text
const NO_HTML = /[<>]/;

const gigBodyRules = ({ partial }) => {
    const start = (field) => {
      const chain = body(field);
      return partial ? chain.optional() : chain.exists({ values: 'falsy' }).withMessage(`${label(field)} is required`).bail();
    }; 

    return [
    start('title')
      .isString().withMessage('Title must be text').bail()
      .trim()
      .isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters').bail()
      .not().matches(NO_HTML).withMessage('Title must not contain < or >'),

    start('description')
      .isString().withMessage('Description must be text').bail()
      .trim()
      .isLength({ min: 20, max: 2000 }).withMessage('Description must be between 20 and 2000 characters').bail()
      .not().matches(NO_HTML).withMessage('Description must not contain < or >'),

    start('price')
      .custom((value) => typeof value === 'number' && Number.isFinite(value))
      .withMessage('Price must be a number').bail()
      .custom((value) => value >= 1 && value <= 1000000)
      .withMessage('Price must be between 1 and 1000000').bail()
      .custom((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-7)
      .withMessage('Price must have at most 2 decimal places'),

    start('category')
      .isString().withMessage('Category must be text').bail()
      .isIn(GIG_CATEGORIES).withMessage(`Category must be one of: ${GIG_CATEGORIES.join(', ')}`),

    // isActive is never required, even on create (defaults to true).
    body('isActive')
      .optional()
      .custom((value) => typeof value === 'boolean')
      .withMessage('isActive must be true or false')
  ];
};

const label = (field) => field.charAt(0).toUpperCase() + field.slice(1);

const validateCreateGig = [...gigBodyRules({ partial: false }), handleValidation];
const validateReplaceGig = [...gigBodyRules({ partial: false }), handleValidation];
const validatePatchGig = [requireAtLeastOneField, ...gigBodyRules({ partial: true }), handleValidation];
const validateGigId = [param('id').isMongoId().withMessage('Invalid gig id'), handleValidation];

// Splitting rules (pagination)
const paginationRules = [
    query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('Page must be a whole number of 1 or more').toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be a whole number from 1 to 50').toInt()
];

const validateListQuery = [...paginationRules,
  query('category').optional().isString().withMessage('category must be text').bail().isIn(GIG_CATEGORIES).withMessage('category is not valid'),
  query('q').optional().isString().withMessage('q must be text').bail().trim().isLength({ min: 1, max: 100 }).withMessage('q must be 1 to 100 characters'),
  query('minPrice').optional().isFloat({ min: 0, max: 1000000 }).withMessage('minPrice must be a number from 0 to 1000000').toFloat(),
  query('maxPrice').optional().isFloat({ min: 0, max: 1000000 }).withMessage('maxPrice must be a number from 0 to 1000000').toFloat(),
  query('minPrice').custom((value, { req }) => {const max = req.query.maxPrice;
    return max === undefined || Number(value) <= Number(max);
  }).withMessage('minPrice must not be greater than maxPrice'),
  query('sort').optional().isString().bail().isIn(SORT_OPTIONS).withMessage(`sort must be one of: ${SORT_OPTIONS.join(', ')}`),
  handleValidation
];

const validatePagination = [...paginationRules, handleValidation];

module.exports = {
    ALLOWED_FIELDS,
    rejectUnknownFields,
    validateCreateGig,
    validateReplaceGig,
    validatePatchGig,
    validateGigId,
    validateListQuery,
    validatePagination
};