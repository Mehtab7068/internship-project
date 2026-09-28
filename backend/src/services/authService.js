const User = require('../models/User');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const { ValidationError, AuthenticationError, NotFoundError } = require('../utils/errors');

class AuthService {
  async register({ name, email, password, phone, role, referralCode }) {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) throw new ValidationError('An account with this email already exists');

    const passwordHash = await User.hashPassword(password);
    const userReferralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();

    let referredByUser = null;
    if (referralCode) {
      referredByUser = await User.findOne({ referralCode: referralCode.toUpperCase() });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      phone,
      role: role || 'USER',
      referralCode: userReferralCode,
      referredBy: referredByUser ? referredByUser._id : null
    });

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        referralCode: user.referralCode
      },
      token,
      refreshToken
    };
  }

  async login({ email, password }) {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) throw new AuthenticationError('Invalid email or password');

    const isMatch = await user.matchPassword(password);
    if (!isMatch) throw new AuthenticationError('Invalid email or password');

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        referralCode: user.referralCode
      },
      token,
      refreshToken
    };
  }

  async getCurrentUser(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async refresh(refreshToken) {
    if (!refreshToken) throw new AuthenticationError('Refresh token is required');
    let decoded;
    try {
      decoded = require('../utils/jwt').verifyRefreshToken(refreshToken);
    } catch (err) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }
    const user = await User.findById(decoded.id);
    if (!user) throw new AuthenticationError('User no longer exists');
    const token = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        referralCode: user.referralCode
      },
      token,
      refreshToken: newRefreshToken
    };
  }
}

module.exports = new AuthService();
