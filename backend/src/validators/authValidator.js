const { check } = require('express-validator');
const validate = require('./validationResultHandler');

const registerRules = [
  check('name').notEmpty().withMessage('Name is required').trim(),
  check('email').isEmail().withMessage('Please include a valid email').normalizeEmail(),
  check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  validate
];

const loginRules = [
  check('email').isEmail().withMessage('Please include a valid email').normalizeEmail(),
  check('password').notEmpty().withMessage('Password is required'),
  validate
];

module.exports = { registerRules, loginRules };
