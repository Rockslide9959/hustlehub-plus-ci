// Central error handlers.
//
// Every error leaves the API in the same safe shape: { message }.
// Internal details (stack traces, file paths, database messages) are only
// written to the server log, never sent to the client.

const logger = require('../utils/logger');

// 404 for any route that does not exist
const notFound = (req, res) => {
    res.status(404).json({ message: 'Route not found' });
};

// Errors we expect and can explain safely to the user
const describeKnownError = (err) => {
    // Body was not valid JSON (thrown by express.json)
    if (err.type === 'entity.parse.failed') {
        return { status: 400, message: 'Request body must be valid JSON.' };
    }

    // Body was bigger than the 10kb limit set in server.js
    if (err.type === 'entity.too.large') {
        return { status: 413, message: 'Request body is too large.' };
    }

    // An id that MongoDB could not understand (e.g. /api/gigs/abc)
    if (err.name === 'CastError') {
        return { status: 400, message: 'Invalid id format.' };
    }

    // Mongoose schema rules failed
    if (err.name === 'ValidationError') {
        return {
            status: 400,
            message: 'Some of the information you entered is not valid.',
            errors: Object.values(err.errors || {}).map((e) => ({ field: e.path, message: e.message }))
        };
    }

    // Unique index clash (e.g. two sign-ups with the same email at once)
    if (err.code === 11000) {
        return { status: 409, message: 'That record already exists.' };
    }

    return null;
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    const known = describeKnownError(err);

    if (known) {
        // Log known client-side errors at 'warn' level — they're the client's fault,
        // not the server's, but they're still worth tracking for suspicious patterns.
        logger.warn('known_error', {
            event: 'error',
            outcome: 'known',
            status: known.status,
            method: req.method,
            path: req.originalUrl,
            message: known.message,
            errorName: err.name,
            errorCode: err.code,
            userId: req.user?.id,
            ip: req.ip,
        });

        const body = { message: known.message };
        if (known.errors && known.errors.length > 0) {
            body.errors = known.errors;
        }
        return res.status(known.status).json(body);
    }

    // Anything else is a server fault: log it with full context, send nothing revealing
    logger.error('unhandled_error', {
        event: 'error',
        outcome: 'unhandled',
        method: req.method,
        path: req.originalUrl,
        message: err.message,
        stack: err.stack,
        userId: req.user?.id,
        ip: req.ip,
    });

    return res.status(500).json({ message: 'An unexpected error occurred. Please try again later.' });
};

module.exports = { notFound, errorHandler };