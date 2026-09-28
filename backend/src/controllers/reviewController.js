const reviewService = require('../services/reviewService');

const getReviews = async (req, res, next) => {
  try {
    const { category } = req.query;
    const reviews = await reviewService.getReviews(category);
    res.status(200).json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    next(error);
  }
};

const createReview = async (req, res, next) => {
  try {
    const { rating, comment, competitionCategory } = req.body;
    const review = await reviewService.addReview({
      user: req.user._id,
      userName: req.user.name,
      userAvatar: req.user.profileImage,
      rating,
      comment,
      competitionCategory
    });
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

module.exports = { getReviews, createReview };
