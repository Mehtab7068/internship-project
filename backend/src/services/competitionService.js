const Competition = require('../models/Competition');
const Judge = require('../models/Judge');
const Registration = require('../models/Registration');
const Submission = require('../models/Submission');
const Winner = require('../models/Winner');
const { NotFoundError } = require('../utils/errors');
const mongoose = require('mongoose');

class CompetitionService {
  async getCompetitions(filter = {}) {
    const competitions = await Competition.find(filter)
      .populate('judge')
      .sort({ createdAt: -1 })
      .lean();
    return competitions.map((comp) => ({
      ...comp,
      availableSpots: Math.max(0, comp.totalSpots - comp.bookedSpots),
      serverTime: new Date()
    }));
  }

  async _findCompetition(idOrSlug, projection = null, populateJudge = false) {
    let competition;
    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      let q = Competition.findById(idOrSlug);
      if (projection) q = q.select(projection);
      if (populateJudge) q = q.populate('judge');
      competition = await q;
    } else {
      const words = idOrSlug.replace(/-/g, ' ').split(' ').filter(Boolean);
      const regexPattern = words.join('.*');
      let q = Competition.findOne({
        $or: [
          { title: { $regex: new RegExp(regexPattern, 'i') } },
          { title: { $regex: new RegExp(idOrSlug.replace(/-/g, ' '), 'i') } },
          { category: { $regex: new RegExp(idOrSlug, 'i') } }
        ]
      });
      if (projection) q = q.select(projection);
      if (populateJudge) q = q.populate('judge');
      competition = await q;
    }
    return competition;
  }

  async getCompetitionById(competitionId, userId = null) {
    const competition = await this._findCompetition(competitionId, null, true);
    if (!competition) throw new NotFoundError('Competition not found');

    const computedStatus = competition.getComputedStatus();
    const availableSpots = Math.max(0, competition.totalSpots - competition.bookedSpots);
    const winners = await Winner.find({ competition: competition._id }).sort({ rank: 1 }).lean();

    let userState = {
      isLoggedIn: false,
      isRegistered: false,
      status: null,
      hasSubmitted: false,
      submission: null
    };

    if (userId) {
      userState.isLoggedIn = true;
      const registration = await Registration.findOne({
        user: userId,
        competition: competition._id
      }).lean();

      if (registration) {
        userState.isRegistered = true;
        userState.status = registration.status;

        const submission = await Submission.findOne({
          user: userId,
          competition: competition._id
        }).lean();

        if (submission) {
          userState.hasSubmitted = true;
          userState.submission = submission;
        }
      }
    }

    return {
      ...competition.toObject(),
      computedStatus,
      availableSpots,
      winners,
      userState,
      serverTime: new Date()
    };
  }

  async getWinners(competitionId) {
    const competition = await this._findCompetition(competitionId, 'previousWinners');
    if (competition && competition.previousWinners && competition.previousWinners.length > 0) {
      return competition.previousWinners;
    }
    const targetId = competition ? competition._id : (mongoose.Types.ObjectId.isValid(competitionId) ? competitionId : null);
    if (!targetId) return [];
    return await Winner.find({ competition: targetId }).sort({ rank: 1 }).lean();
  }

  async getRewards(competitionId) {
    const competition = await this._findCompetition(competitionId, 'rewards prizePool');
    if (!competition) throw new NotFoundError('Competition not found');
    return {
      prizePool: competition.prizePool,
      rewards: competition.rewards || []
    };
  }

  async createCompetition(data) {
    return await Competition.create(data);
  }

  async updateCompetition(id, data) {
    const competition = await Competition.findByIdAndUpdate(id, data, {
      returnDocument: 'after',
      runValidators: true
    });
    if (!competition) throw new NotFoundError('Competition not found');
    return competition;
  }
}

module.exports = new CompetitionService();
