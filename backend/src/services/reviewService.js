const Review = require('../models/Review');

class ReviewService {
  async getReviews(category = null) {
    const filter = category ? { competitionCategory: category } : {};
    return await Review.find(filter).sort({ createdAt: -1 }).limit(10).lean();
  }

  async addReview(data) {
    return await Review.create(data);
  }
}

module.exports = new ReviewService();
