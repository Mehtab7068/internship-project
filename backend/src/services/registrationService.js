const mongoose = require('mongoose');
const Competition = require('../models/Competition');
const Registration = require('../models/Registration');
const {
  NotFoundError,
  CompetitionFullError,
  RegistrationClosedError,
  DuplicateRegistrationError
} = require('../utils/errors');

// Pending-payment reservations expire after 10 minutes (per spec).
const PENDING_PAYMENT_TTL_MS = 10 * 60 * 1000;

class RegistrationService {
  /**
   * Reserve a spot for the authenticated user. Creates (or reuses) a
   * pending_payment registration with a 10-minute expiry hold. The spot
   * counter is incremented atomically so concurrent requests can never
   * overbook the competition.
   */
  async reserveSpot({ userId, competitionId }) {
    const compDoc = await Competition.findById(competitionId);
    if (!compDoc) throw new NotFoundError('Competition not found');

    if (['draft', 'cancelled', 'completed'].includes(compDoc.status)) {
      throw new RegistrationClosedError(`Registration is not available. Status: ${compDoc.status}`);
    }

    const now = new Date();
    if (now > compDoc.registerBeforeAt) {
      throw new RegistrationClosedError('Registration deadline has passed');
    }

    // Reuse ANY existing registration for this user/competition (including
    // cancelled/expired ones) so a past cancellation never blocks
    // re-registration. The unique {user, competition} index guarantees at
    // most one document per user per competition.
    const registration = await Registration.findOne({ user: userId, competition: competitionId });

    if (registration && registration.status === 'confirmed') {
      throw new DuplicateRegistrationError('You are already registered for this competition');
    }

    // An active (non-expired) pending_payment reservation is simply returned
    // so repeated reserve calls never consume extra spots.
    if (
      registration &&
      registration.status === 'pending_payment' &&
      registration.expiresAt && registration.expiresAt > now
    ) {
      return {
        registration,
        bookedSpots: compDoc.bookedSpots,
        totalSpots: compDoc.totalSpots,
        availableSpots: Math.max(0, compDoc.totalSpots - compDoc.bookedSpots),
        expiresAt: registration.expiresAt
      };
    }

    // Atomic conditional update (TOCTOU-safe): only increment when spots
    // remain AND the registration window is still open.
    const updatedComp = await Competition.findOneAndUpdate(
      {
        _id: competitionId,
        $expr: {
          $and: [
            { $lt: ['$bookedSpots', '$totalSpots'] },
            { $gt: ['$registerBeforeAt', now] }
          ]
        }
      },
      { $inc: { bookedSpots: 1 } },
      { returnDocument: 'after' }
    );

    if (!updatedComp) {
      throw new CompetitionFullError('All spots for this competition have been filled');
    }

    const expiresAt = new Date(Date.now() + PENDING_PAYMENT_TTL_MS);

    try {
      let doc;
      if (registration) {
        registration.status = 'pending_payment';
        registration.registeredAt = new Date();
        registration.expiresAt = expiresAt;
        doc = await registration.save();
      } else {
        doc = await Registration.create({
          user: userId,
          competition: competitionId,
          status: 'pending_payment',
          registeredAt: new Date(),
          expiresAt
        });
      }

      return {
        registration: doc,
        bookedSpots: updatedComp.bookedSpots,
        totalSpots: updatedComp.totalSpots,
        availableSpots: Math.max(0, updatedComp.totalSpots - updatedComp.bookedSpots),
        expiresAt
      };
    } catch (err) {
      // Rollback the spot increment if the registration write fails
      await Competition.findByIdAndUpdate(competitionId, { $inc: { bookedSpots: -1 } });
      if (err.code === 11000) {
        throw new DuplicateRegistrationError('You are already registered for this competition');
      }
      throw err;
    }
  }

  _applyConfirmation(registration, { razorpayPaymentId, razorpayOrderId, amountPaid }) {
    if (razorpayPaymentId) registration.razorpayPaymentId = razorpayPaymentId;
    if (razorpayOrderId) registration.razorpayOrderId = razorpayOrderId;
    if (amountPaid) registration.amountPaid = amountPaid;
    registration.status = 'confirmed';
    registration.registeredAt = new Date();
    registration.expiresAt = null;
  }

  /**
   * Confirm a registration after a verified payment. The spot was already
   * counted at reservation time — confirmation never increments again.
   */
  async confirmRegistration({ userId, competitionId, razorpayPaymentId = null, razorpayOrderId = null, amountPaid = 0 }) {
    const registration = await Registration.findOne({ user: userId, competition: competitionId });

    // Safety net: no reservation exists (e.g. webhook-only flow) — acquire a
    // spot atomically and create a confirmed registration.
    if (!registration) {
      const updatedComp = await Competition.findOneAndUpdate(
        { _id: competitionId, $expr: { $lt: ['$bookedSpots', '$totalSpots'] } },
        { $inc: { bookedSpots: 1 } },
        { returnDocument: 'after' }
      );
      if (!updatedComp) throw new CompetitionFullError('All spots for this competition have been filled');
      try {
        return await Registration.create({
          user: userId,
          competition: competitionId,
          status: 'confirmed',
          razorpayPaymentId,
          razorpayOrderId,
          amountPaid,
          registeredAt: new Date(),
          expiresAt: null
        });
      } catch (err) {
        await Competition.findByIdAndUpdate(competitionId, { $inc: { bookedSpots: -1 } });
        if (err.code === 11000) {
          throw new DuplicateRegistrationError('You are already registered for this competition');
        }
        throw err;
      }
    }

    // Already confirmed — idempotent, just refresh payment details.
    if (registration.status === 'confirmed') {
      this._applyConfirmation(registration, { razorpayPaymentId, razorpayOrderId, amountPaid });
      await registration.save();
      return registration;
    }

    // Reservation was released (expired/cancelled) — re-acquire a spot first.
    if (registration.status === 'cancelled' || registration.status === 'expired') {
      const updatedComp = await Competition.findOneAndUpdate(
        { _id: competitionId, $expr: { $lt: ['$bookedSpots', '$totalSpots'] } },
        { $inc: { bookedSpots: 1 } },
        { returnDocument: 'after' }
      );
      if (!updatedComp) throw new CompetitionFullError('All spots for this competition have been filled');
      try {
        this._applyConfirmation(registration, { razorpayPaymentId, razorpayOrderId, amountPaid });
        await registration.save();
      } catch (err) {
        await Competition.findByIdAndUpdate(competitionId, { $inc: { bookedSpots: -1 } });
        throw err;
      }
      return registration;
    }

    // pending_payment → confirm in place (spot already counted).
    this._applyConfirmation(registration, { razorpayPaymentId, razorpayOrderId, amountPaid });
    await registration.save();
    return registration;
  }

  /**
   * Expire stale pending_payment reservations and release their reserved
   * spots. Prefers a MongoDB transaction (replica set); falls back to atomic
   * two-step updates on standalone deployments.
   */
  async expireStaleRegistrations() {
    const now = new Date();
    const stale = await Registration.find({ status: 'pending_payment', expiresAt: { $lte: now } }).limit(200);
    let expiredCount = 0;

    for (const registration of stale) {
      let usedTransaction = false;
      let session;
      try {
        session = await mongoose.startSession();
        await session.withTransaction(async () => {
          const updated = await Registration.findOneAndUpdate(
            { _id: registration._id, status: 'pending_payment' },
            { $set: { status: 'expired' } },
            { new: true, session }
          );
          if (updated) {
            await Competition.findByIdAndUpdate(
              registration.competition,
              { $inc: { bookedSpots: -1 } },
              { session }
            );
            expiredCount++;
          }
        });
        usedTransaction = true;
      } catch (txErr) {
        // Standalone MongoDB (no replica set) — fall through to atomic fallback
      } finally {
        if (session) {
          try { await session.endSession(); } catch (e) { /* noop */ }
        }
      }

      if (!usedTransaction) {
        try {
          const updated = await Registration.findOneAndUpdate(
            { _id: registration._id, status: 'pending_payment' },
            { $set: { status: 'expired' } },
            { new: true }
          );
          if (updated) {
            await Competition.findByIdAndUpdate(registration.competition, { $inc: { bookedSpots: -1 } });
            expiredCount++;
          }
        } catch (err) {
          console.error(`Failed to expire registration ${registration._id}:`, err.message);
        }
      }
    }

    return expiredCount;
  }

  async getUserRegistration(competitionId, userId) {
    return await Registration.findOne({ competition: competitionId, user: userId })
      .populate('competition', 'title category prizePool entryFee');
  }

  async cancelRegistration(competitionId, userId) {
    const registration = await Registration.findOne({ competition: competitionId, user: userId, status: { $ne: 'cancelled' } });
    if (!registration) throw new NotFoundError('Registration not found');

    registration.status = 'cancelled';
    await registration.save();
    await Competition.findByIdAndUpdate(competitionId, { $inc: { bookedSpots: -1 } });

    return { message: 'Registration cancelled successfully' };
  }
}

module.exports = new RegistrationService();
