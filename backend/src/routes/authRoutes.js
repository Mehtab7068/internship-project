const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerRules, loginRules } = require('../validators/authValidator');
const { protect } = require('../middleware/auth');

router.post('/register', registerRules, authController.register);
router.post('/login', loginRules, authController.login);
router.post('/refresh', authController.refresh);
router.get('/me', protect, authController.getMe);
router.post('/logout', protect, authController.logout);

module.exports = router;
