const submissionService = require('../services/submissionService');

const createSubmission = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const file = req.file;
    const submission = await submissionService.createSubmission({
      userId: req.user._id,
      competitionId: req.params.id,
      file,
      title,
      description
    });
    res.status(201).json({ success: true, message: 'Submission uploaded successfully', data: submission });
  } catch (error) {
    next(error);
  }
};

const getSubmission = async (req, res, next) => {
  try {
    const submission = await submissionService.getSubmission(req.params.id, req.user._id);
    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    next(error);
  }
};

const getCompetitionSubmissions = async (req, res, next) => {
  try {
    const submissions = await submissionService.getCompetitionSubmissions(req.params.id);
    res.status(200).json({ success: true, count: submissions.length, data: submissions });
  } catch (error) {
    next(error);
  }
};

module.exports = { createSubmission, getSubmission, getCompetitionSubmissions };
