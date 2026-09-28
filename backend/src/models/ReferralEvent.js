const mongoose = require('mongoose');
const referralEventSchema = new mongoose.Schema({
  referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referredUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rewardAmount: { type: Number, default: 10 },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('ReferralEvent', referralEventSchema);
