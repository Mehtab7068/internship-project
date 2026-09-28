const crypto = require('crypto');
const Razorpay = require('razorpay');
const Competition = require('../models/Competition');
const Registration = require('../models/Registration');
const registrationService = require('./registrationService');
const { PaymentError, NotFoundError, RegistrationClosedError, CompetitionFullError } = require('../utils/errors');

class PaymentService {
  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    // Mock mode is used for local development and tests when real Razorpay
    // credentials are not configured. It must NEVER be enabled in production.
    this.mock =
      process.env.RAZORPAY_MOCK === 'true' ||
      (!this.keyId || !this.keySecret);

    if (!this.mock) {
      try {
        this.razorpay = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
      } catch (e) {
        this.razorpay = null;
        this.mock = true;
      }
    } else {
      this.razorpay = null;
    }
  }

  _mockSignature(orderId, paymentId) {
    const secret = this.keySecret || 'mock_secret_for_dev';
    return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  }

  async createOrder({ competitionId, userId }) {
    const competition = await Competition.findById(competitionId);
    if (!competition) throw new NotFoundError('Competition not found');

    // Reserve the spot first (atomic, 10-minute hold). Throws if full/closed
    // or the user already has a confirmed registration.
    const reservation = await registrationService.reserveSpot({ userId, competitionId });

    const amountInPaise = Math.round(competition.entryFee * 100);
    const receipt = `rcpt_${competitionId.toString().slice(-6)}_${Date.now().toString().slice(-6)}`;

    let order;
    if (this.mock) {
      order = {
        id: `order_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        entity: 'order',
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency: 'INR',
        receipt,
        status: 'created',
        created_at: Math.floor(Date.now() / 1000)
      };
    } else {
      order = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: { competitionId: competitionId.toString(), userId: userId.toString() }
      });
    }

    // Persist the order id on the reservation so webhooks can reconcile it.
    const registration = reservation.registration;
    registration.razorpayOrderId = order.id;
    await registration.save();

    const response = {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: this.mock ? 'rzp_test_mock' : this.keyId,
      competitionTitle: competition.title,
      entryFee: competition.entryFee,
      mock: this.mock,
      expiresAt: registration.expiresAt,
      bookedSpots: reservation.bookedSpots,
      availableSpots: reservation.availableSpots
    };

    // In mock mode provide pre-computed credentials so the client can complete
    // the simulated checkout and pass strict signature verification.
    if (this.mock) {
      response.mockPaymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      response.mockSignature = this._mockSignature(order.id, response.mockPaymentId);
    }

    return response;
  }

  async verifyPayment({ orderId, paymentId, signature, competitionId, userId }) {
    if (!orderId || !paymentId) {
      throw new PaymentError('Order ID and Payment ID are required for verification');
    }

    // Idempotency: if this payment/order already confirmed a registration, return it
    const orConditions = [
      { razorpayPaymentId: paymentId },
      { razorpayOrderId: orderId, status: 'confirmed' }
    ];
    if (competitionId && userId) {
      orConditions.push({ user: userId, competition: competitionId, status: 'confirmed' });
    }

    const existingRegistration = await Registration.findOne({ $or: orConditions });

    if (existingRegistration && existingRegistration.status === 'confirmed') {
      const compDoc = competitionId ? await Competition.findById(competitionId) : null;
      return {
        success: true,
        alreadyProcessed: true,
        registration: existingRegistration,
        bookedSpots: compDoc ? compDoc.bookedSpots : undefined,
        availableSpots: compDoc ? Math.max(0, compDoc.totalSpots - compDoc.bookedSpots) : undefined,
        message: 'Payment was already verified and registration confirmed'
      };
    }

    // ALWAYS verify the HMAC signature (strict, both mock and real mode)
    const expected = this._mockSignature(orderId, paymentId);
    const provided = String(signature || '');
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      throw new PaymentError('Invalid payment signature');
    }

    const competition = await Competition.findById(competitionId);
    if (!competition) throw new NotFoundError('Competition not found');

    const registration = await registrationService.confirmRegistration({
      userId,
      competitionId,
      razorpayPaymentId: paymentId,
      razorpayOrderId: orderId,
      amountPaid: competition.entryFee
    });

    const compDoc = await Competition.findById(competitionId);
    return {
      success: true,
      registration,
      availableSpots: Math.max(0, compDoc.totalSpots - compDoc.bookedSpots),
      bookedSpots: compDoc.bookedSpots,
      message: 'Payment verified and registration confirmed successfully'
    };
  }

  async handleWebhook(rawBody, signature) {
    if (!this.webhookSecret) {
      throw new PaymentError('Webhook secret is not configured');
    }
    if (!rawBody || !signature) {
      throw new PaymentError('Webhook payload and signature are required');
    }

    const expected = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(String(signature));
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      throw new PaymentError('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    if (event.event === 'payment.captured') {
      const payment = event.payload && event.payload.payment && event.payload.payment.entity;
      if (payment) {
        await this.reconcilePayment({
          orderId: payment.order_id,
          paymentId: payment.id,
          amountPaid: payment.amount / 100
        });
      }
    }
    return { handled: true };
  }

  async reconcilePayment({ orderId, paymentId, amountPaid }) {
    const registration = await Registration.findOne({ razorpayOrderId: orderId });
    if (!registration) return { reconciled: false, reason: 'Registration not found for order' };

    if (registration.status === 'pending_payment') {
      registration.status = 'confirmed';
      registration.razorpayPaymentId = paymentId || registration.razorpayPaymentId;
      registration.amountPaid = amountPaid || registration.amountPaid;
      registration.expiresAt = null;
      await registration.save();
      return { reconciled: true };
    }

    if (registration.status === 'expired' || registration.status === 'cancelled') {
      // Payment arrived late — re-confirm if a spot is still available
      const updatedComp = await Competition.findOneAndUpdate(
        { _id: registration.competition, $expr: { $lt: ['$bookedSpots', '$totalSpots'] } },
        { $inc: { bookedSpots: 1 } },
        { returnDocument: 'after' }
      );
      if (!updatedComp) return { reconciled: false, reason: 'Competition is full' };
      registration.status = 'confirmed';
      registration.razorpayPaymentId = paymentId || registration.razorpayPaymentId;
      registration.amountPaid = amountPaid || registration.amountPaid;
      registration.expiresAt = null;
      await registration.save();
      return { reconciled: true };
    }

    return { reconciled: false, reason: `Registration already ${registration.status}` };
  }
}

module.exports = new PaymentService();
