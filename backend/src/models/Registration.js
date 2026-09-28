const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        competition: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Competition',
            required: true
        },
        status: {
            type: String,
            enum: ['pending_payment', 'confirmed', 'cancelled', 'expired'],
            default: 'pending_payment'
        },
        razorpayPaymentId: {
            type: String,
            default: null
        },
        razorpayOrderId: {
            type: String,
            default: null
        },
        amountPaid: {
            type: Number,
            default: 0
        },
        registeredAt: {
            type: Date,
            default: Date.now
        },
        expiresAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

registrationSchema.index({ user: 1, competition: 1 }, { unique: true });
registrationSchema.index({ competition: 1, status: 1 });
// Partial index for the expiry job: only pending_payment docs carry expiresAt.
// (A TTL index is intentionally avoided — it would delete documents without
// releasing the reserved spot in the competition's bookedSpots counter.)
registrationSchema.index(
    { expiresAt: 1 },
    { partialFilterExpression: { status: 'pending_payment' } }
);

module.exports = mongoose.model('Registration', registrationSchema);