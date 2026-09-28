const User = require('../models/User');
const { NotFoundError } = require('../utils/errors');

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) throw new NotFoundError('User not found');
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, profileImage } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) throw new NotFoundError('User not found');

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (profileImage) user.profileImage = profileImage;
    await user.save();

    res.status(200).json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile };
