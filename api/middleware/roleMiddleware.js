// Role-based Access Control middleware for handling different user roles and permissions

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required'});
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied: insufficient permissions'});
        }
        next();
    };
};

module.exports = { authorizeRoles };