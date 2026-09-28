const mongoose = require('mongoose');
require('./Judge');

const judgingParameterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    nameHindi: { type: String },
    weightage: { type: Number, required: true, min: 0, max: 100 },
    description: { type: String }
  },
  { _id: false }
);

const rewardSchema = new mongoose.Schema(
  {
    rank: { type: Number, required: true },
    title: { type: String, required: true },
    titleHindi: { type: String },
    amount: { type: Number, required: true, min: 0 },
    certificateType: { type: String, default: 'Certificate of Excellence' }
  },
  { _id: false }
);

const competitionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Competition title is required'],
      trim: true
    },
    titleHindi: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },
    categoryHindi: {
      type: String,
      trim: true
    },
    tags: [{ type: String, trim: true }],
    tagsHindi: [{ type: String, trim: true }],
    prizePool: {
      type: Number,
      required: [true, 'Prize pool is required'],
      min: [0, 'Prize pool cannot be negative']
    },
    entryFee: {
      type: Number,
      required: [true, 'Entry fee is required'],
      min: [0, 'Entry fee cannot be negative']
    },
    totalSpots: {
      type: Number,
      required: [true, 'Total spots is required'],
      min: [1, 'Must have at least 1 spot']
    },
    bookedSpots: {
      type: Number,
      default: 0,
      min: [0, 'Booked spots cannot be negative']
    },
    description: {
      type: String,
      required: [true, 'Description is required']
    },
    descriptionHindi: {
      type: String
    },
    judgingParameters: [judgingParameterSchema],
    rules: [{ type: String }],
    rulesHindi: [{ type: String }],
    eligibility: [{ type: String }],
    eligibilityHindi: [{ type: String }],
    registrationStart: {
      type: Date,
      default: Date.now
    },
    registerBeforeAt: {
      type: Date,
      required: [true, 'Registration end date is required']
    },
    submissionStartAt: {
      type: Date,
      required: [true, 'Submission start date is required']
    },
    submissionEndAt: {
      type: Date,
      required: [true, 'Submission end date is required']
    },
    resultAt: {
      type: Date,
      required: [true, 'Result date is required']
    },
    status: {
      type: String,
      enum: [
        'draft',
        'upcoming',
        'registration_open',
        'registration_closed',
        'submission_open',
        'submission_closed',
        'judging',
        'results_declared',
        'completed',
        'cancelled'
      ],
      default: 'registration_open'
    },
    judge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Judge',
      required: true
    },
    rewards: [rewardSchema],
    previousWinners: [{
      rank: Number,
      name: String,
      photoUrl: String,
      videoUrl: String
    }],
    isMultiWin: { type: Boolean, default: false },
    certificateForWinners: { type: Boolean, default: false },
    disclaimer: {
      type: String,
      default: 'Only contributions from paid participants will be considered for judging.'
    },
    disclaimerHindi: {
      type: String,
      default: 'केवल सशुल्क प्रतिभागियों के योगदान को ही मूल्यांकन के लिए माना जाएगा।'
    },
    introVideoUrl: {
      type: String,
      default: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    },
    prizeInfoVideoUrl: {
      type: String,
      default: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
    },
    refundPolicyText: {
      type: String,
      default: 'Full refund guaranteed if competition is cancelled by organizer.'
    },
    refundPolicyHindi: {
      type: String,
      default: 'यदि आयोजक द्वारा प्रतियोगिता रद्द की जाती है तो पूर्ण धनवापसी की गारंटी।'
    },
    language: {
      type: String,
      default: 'ENG'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

competitionSchema.virtual('availableSpots').get(function () {
  return Math.max(0, (this.totalSpots || 0) - (this.bookedSpots || 0));
});

competitionSchema.methods.getComputedStatus = function () {
  if (['draft', 'cancelled', 'completed'].includes(this.status)) {
    return this.status;
  }
  const now = new Date();
  if (now < this.registrationStart) return 'upcoming';
  if (now >= this.resultAt) return 'results_declared';
  if (now > this.submissionEndAt) return 'submission_closed';
  if (now >= this.submissionStartAt && now <= this.submissionEndAt) return 'submission_open';
  if (now > this.registerBeforeAt) return 'registration_closed';
  if (this.bookedSpots >= this.totalSpots) return 'registration_closed';
  return 'registration_open';
};

competitionSchema.index({ status: 1, registerBeforeAt: 1 });
competitionSchema.index({ category: 1 });

module.exports = mongoose.model('Competition', competitionSchema);
