const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema(
  {
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Competition',
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    name: { type: String, required: true },
    profileImage: { type: String, required: true },
    position: { type: String, required: true },
    rank: { type: Number, required: true },
    prizeAmount: { type: Number, default: 0 },
    certificateUrl: { type: String },
    performanceVideoUrl: {
      type: String,
      default: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    },
    category: { type: String, default: 'Classical Dance' }
  },
  { timestamps: true }
);

winnerSchema.index({ competition: 1, rank: 1 });

module.exports = mongoose.model('Winner', winnerSchema);
