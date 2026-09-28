const referralService = require('../services/referralService');

const getReferralInfo = async (req, res, next) => {
  try {
    const referralInfo = await referralService.getReferralInfo(req.user._id);
    res.status(200).json({ success: true, data: referralInfo });
  } catch (error) {
    next(error);
  }
};

const claimReferral = async (req, res, next) => {
  try {
    const { referralCode } = req.body;
    const result = await referralService.trackReferral({
      referrerCode: referralCode,
      referredUserId: req.user._id
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { getReferralInfo, claimReferral };
