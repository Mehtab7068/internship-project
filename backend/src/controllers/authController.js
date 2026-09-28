const authService = require('../services/authService');

const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, referralCode } = req.body;
    const result = await authService.register({ name, email, password, phone, role, referralCode });
    res.status(201).json({ success: true, message: 'User registered successfully', data: result });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.status(200).json({ success: true, message: 'Logged in successfully', data: result });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    res.status(200).json({ success: true, message: 'Token refreshed successfully', data: result });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user._id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, refresh, getMe, logout };
