const paymentService = require('../services/paymentService');

const createOrder = async (req, res, next) => {
  try {
    const { competitionId } = req.body;
    const order = await paymentService.createOrder({ competitionId, userId: req.user._id });
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { orderId, paymentId, signature, competitionId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const result = await paymentService.verifyPayment({
      orderId: orderId || razorpay_order_id,
      paymentId: paymentId || razorpay_payment_id,
      signature: signature || razorpay_signature,
      competitionId,
      userId: req.user._id
    });
    res.status(200).json({ success: true, message: result.message, data: result });
  } catch (error) {
    next(error);
  }
};

const webhook = async (req, res, next) => {
  try {
    await paymentService.handleWebhook(req.rawBody, req.headers['x-razorpay-signature']);
    res.status(200).json({ status: 'ok', received: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { createOrder, verifyPayment, webhook };
