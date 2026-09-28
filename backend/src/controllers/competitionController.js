const competitionService = require('../services/competitionService');

const getCompetitions = async (req, res, next) => {
  try {
    const competitions = await competitionService.getCompetitions();
    res.status(200).json({ success: true, count: competitions.length, data: competitions });
  } catch (error) {
    next(error);
  }
};

const getCompetitionById = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : null;
    const competition = await competitionService.getCompetitionById(req.params.id, userId);
    res.status(200).json({ success: true, data: competition });
  } catch (error) {
    next(error);
  }
};

const getCompetitionStatus = async (req, res, next) => {
  try {
    const competition = await competitionService.getCompetitionById(req.params.id, req.user ? req.user._id : null);
    res.status(200).json({
      success: true,
      data: {
        status: competition.status,
        computedStatus: competition.computedStatus,
        totalSpots: competition.totalSpots,
        bookedSpots: competition.bookedSpots,
        availableSpots: competition.availableSpots,
        isFull: competition.bookedSpots >= competition.totalSpots,
        registrationEnd: competition.registerBeforeAt,
        submissionStart: competition.submissionStartAt,
        submissionEnd: competition.submissionEndAt,
        resultDate: competition.resultAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const getWinners = async (req, res, next) => {
  try {
    const winners = await competitionService.getWinners(req.params.id);
    res.status(200).json({ success: true, count: winners.length, data: winners });
  } catch (error) {
    next(error);
  }
};

const getRewards = async (req, res, next) => {
  try {
    const rewards = await competitionService.getRewards(req.params.id);
    res.status(200).json({ success: true, data: rewards });
  } catch (error) {
    next(error);
  }
};

const createCompetition = async (req, res, next) => {
  try {
    const competition = await competitionService.createCompetition(req.body);
    res.status(201).json({ success: true, data: competition });
  } catch (error) {
    next(error);
  }
};

const updateCompetition = async (req, res, next) => {
  try {
    const competition = await competitionService.updateCompetition(req.params.id, req.body);
    res.status(200).json({ success: true, data: competition });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCompetitions,
  getCompetitionById,
  getCompetitionStatus,
  getWinners,
  getRewards,
  createCompetition,
  updateCompetition
};
