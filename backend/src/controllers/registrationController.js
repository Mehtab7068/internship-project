const registrationService = require('../services/registrationService');

const registerForCompetition = async (req, res, next) => {
  try {
    // Server-controlled reservation: clients can never set status/payment
    // fields directly. This creates a pending_payment reservation with a
    // 10-minute hold; confirmation happens ONLY via /api/payments/verify
    // or the Razorpay webhook after a verified payment.
    const result = await registrationService.reserveSpot({
      userId: req.user._id,
      competitionId: req.params.id
    });

    res.status(201).json({
      success: true,
      message: 'Spot reserved. Complete payment within 10 minutes to confirm your registration.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getRegistration = async (req, res, next) => {
  try {
    const registration = await registrationService.getUserRegistration(req.params.id, req.user._id);
    res.status(200).json({ success: true, data: registration });
  } catch (error) {
    next(error);
  }
};

const cancelRegistration = async (req, res, next) => {
  try {
    const result = await registrationService.cancelRegistration(req.params.id, req.user._id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerForCompetition, getRegistration, cancelRegistration };
