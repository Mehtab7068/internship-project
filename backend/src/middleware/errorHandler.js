const { AppError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    if (field === 'user' || (err.keyPattern && err.keyPattern.user && err.keyPattern.competition)) {
      error = new AppError('You are already registered for this competition.', 409);
    } else if (field === 'email') {
      error = new AppError('An account with this email address already exists.', 409);
    } else {
      error = new AppError(`Duplicate value for field: ${field}`, 409);
    }
  }

  if (err.name === 'CastError') {
    error = new AppError(`Resource not found with id: ${err.value}`, 404);
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    error = new AppError(`Validation failed: ${messages.join(', ')}`, 400);
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      error = new AppError('File size exceeds the allowed limit (max 50MB).', 400);
    } else {
      error = new AppError(`Upload error: ${err.message}`, 400);
    }
  }

  res.status(error.statusCode || 500).json({
    success: false,
    status: error.status || 'error',
    message: error.message || 'Internal Server Error',
    errors: err.errors || undefined
  });
};

module.exports = errorHandler;
