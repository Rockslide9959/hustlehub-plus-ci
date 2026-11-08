const mongoose = require('mongoose');

// The logged-in user's id as a real MongoDB ObjectId.
//
// req.user.id comes from a verified JWT, but converting it explicitly means a
// database query can only ever receive a plain id, never an object such as
// { $ne: null } that would change what the query matches (NoSQL injection).
// It also makes that guarantee visible to static analysis (SonarCloud S5147).
const currentUserId = (req) => new mongoose.Types.ObjectId(String(req.user.id));

module.exports = { currentUserId };
