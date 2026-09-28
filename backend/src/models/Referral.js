const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema(
    {
        referrer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        referredUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        referralCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true
        },
        rewardAmount: {
            type: Number,
            default: 10
        },
        status: {
            type: String,
            enum: ['PENDING', 'REWARDED', 'EXPIRED'],
            default: 'PENDING'
        },
        rewardedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

referralSchema.index({ referrer: 1, referredUser: 1 }, { unique: true });
referralSchema.index({ referredUser: 1 });
referralSchema.index({ referralCode: 1 });

module.exports = mongoose.model('Referral', referralSchema);