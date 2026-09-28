const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');
const { AuthenticationError, ForbiddenError } = require('../utils/errors');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AuthenticationError('Not authorized, token missing. Please log in.'));
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return next(new AuthenticationError('User belonging to this token no longer exists.'));
    }
    req.user = user;
    next();
  } catch (error) {
    return next(new AuthenticationError('Invalid or expired authentication token.'));
  }
};

const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('-passwordHash');
    req.user = user || null;
  } catch (error) {
    req.user = null;
  }
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ForbiddenError(`User role '${req.user ? req.user.role : 'GUEST'}' is not authorized`));
    }
    next();
  };
};

module.exports = { protect, optionalAuth, authorize };
