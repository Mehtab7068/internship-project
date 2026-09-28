const User = require('../models/User');
const Referral = require('../models/Referral');
const { NotFoundError, ValidationError } = require('../utils/errors');

class ReferralService {
  async getReferralInfo(userId) {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    if (!user.referralCode) {
      user.referralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
      await user.save();
    }

    const referrals = await Referral.find({ referrer: userId }).populate('referredUser', 'name createdAt');
    const totalEarned = referrals.filter(r => r.status === 'REWARDED').length * 10;

    return {
      referralCode: user.referralCode,
      referralLink: `https://feedants.com/r/${user.referralCode}`,
      rewardPerSignup: 10,
      totalEarned,
      referralCount: referrals.length,
      history: referrals
    };
  }

  async trackReferral({ referrerCode, referredUserId }) {
    if (!referrerCode) throw new ValidationError('Referral code is required');

    const referrer = await User.findOne({ referralCode: referrerCode.toUpperCase() });
    if (!referrer) throw new NotFoundError('Invalid referral code');

    if (referrer._id.toString() === String(referredUserId)) {
      throw new ValidationError('You cannot refer yourself');
    }

    const existing = await Referral.findOne({ referrer: referrer._id, referredUser: referredUserId });
    if (existing) return existing;

    return await Referral.create({
      referrer: referrer._id,
      referredUser: referredUserId,
      referralCode: referrerCode.toUpperCase(),
      rewardAmount: 10,
      status: 'REWARDED'
    });
  }
}

module.exports = new ReferralService();
