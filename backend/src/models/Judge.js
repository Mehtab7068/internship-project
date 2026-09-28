const mongoose = require('mongoose');

const judgeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameHindi: { type: String },
  photoUrl: { type: String, required: true },
  title: { type: String, required: true },
  titleHindi: { type: String },
  experienceYears: { type: Number, required: true },
  introVideoUrl: { type: String },
  bio: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Judge', judgeSchema);
