class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Not authenticated') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access') {
    super(message, 403);
  }
}

class CompetitionFullError extends AppError {
  constructor(message = 'All spots for this competition have been booked') {
    super(message, 409);
  }
}

class RegistrationClosedError extends AppError {
  constructor(message = 'Registration deadline has passed or registration is closed') {
    super(message, 400);
  }
}

class PaymentError extends AppError {
  constructor(message = 'Payment processing or verification failed') {
    super(message, 400);
  }
}

class DuplicateRegistrationError extends AppError {
  constructor(message = 'User is already registered for this competition') {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  CompetitionFullError,
  RegistrationClosedError,
  PaymentError,
  DuplicateRegistrationError
};
