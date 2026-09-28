const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
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
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: true
    },
    fileUrl: {
      type: String,
      required: [true, 'Submission file URL is required']
    },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    fileName: { type: String },
    title: { type: String, default: 'My Competition Entry' },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      default: 'PENDING'
    },
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

submissionSchema.index({ user: 1, competition: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
