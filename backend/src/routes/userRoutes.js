const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.get('/me', protect, userController.getProfile);
router.put('/me', protect, userController.updateProfile);

module.exports = router;
