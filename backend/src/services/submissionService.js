const Submission = require('../models/Submission');
const Registration = require('../models/Registration');
const Competition = require('../models/Competition');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');

class SubmissionService {
  async createSubmission({ userId, competitionId, file, title, description }) {
    if (!file) throw new ValidationError('Submission file is required');

    const registration = await Registration.findOne({
      user: userId,
      competition: competitionId,
      status: 'confirmed'
    });

    if (!registration) {
      throw new ForbiddenError('You must be a confirmed registered participant to submit an entry');
    }

    const competition = await Competition.findById(competitionId);
    if (!competition) throw new NotFoundError('Competition not found');

    const now = new Date();
    if (now < competition.submissionStartAt) {
      throw new ForbiddenError(`Submission window has not opened yet. Starts on ${competition.submissionStartAt.toDateString()}`);
    }

    if (now > competition.submissionEndAt) {
      throw new ForbiddenError('Submission deadline has passed');
    }

    const existingSubmission = await Submission.findOne({ user: userId, competition: competitionId });
    if (existingSubmission) {
      throw new ValidationError('You have already submitted your entry for this competition');
    }

    const fileUrl = `/uploads/${file.filename}`;

    const submission = await Submission.create({
      user: userId,
      competition: competitionId,
      registration: registration._id,
      fileUrl: fileUrl,
      fileType: file.mimetype,
      fileSize: file.size,
      fileName: file.originalname,
      title: title || 'Classical Dance Performance Entry',
      description: description || '',
      status: 'PENDING',
      submittedAt: new Date()
    });

    return submission;
  }

  async getSubmission(competitionId, userId) {
    return await Submission.findOne({ competition: competitionId, user: userId })
      .populate('competition', 'title category');
  }

  async getCompetitionSubmissions(competitionId) {
    return await Submission.find({ competition: competitionId })
      .populate('user', 'name email profileImage')
      .sort({ submittedAt: -1 });
  }
}

module.exports = new SubmissionService();
