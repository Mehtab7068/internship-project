const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_feedants_jwt_key_2026_dev_prod';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super_secret_feedants_jwt_refresh_key_2026_dev_prod';

const generateToken = (userId) => {
  return jwt.sign({ id: userId, type: 'access' }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId, type: 'refresh' }, JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  return decoded;
};

module.exports = { generateToken, generateRefreshToken, verifyToken, verifyRefreshToken };
