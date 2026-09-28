const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, required: true },
    userAvatar: {
      type: String,
      default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    competitionCategory: { type: String, default: 'Classical Dance' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
