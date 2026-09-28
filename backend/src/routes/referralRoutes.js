const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const { protect } = require('../middleware/auth');

router.get('/info', protect, referralController.getReferralInfo);
router.get('/my-code', protect, referralController.getReferralInfo);
router.post('/claim', protect, referralController.claimReferral);

module.exports = router;
