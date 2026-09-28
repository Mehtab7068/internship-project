const express = require('express');
const router = express.Router();
const competitionController = require('../controllers/competitionController');
const registrationController = require('../controllers/registrationController');
const submissionController = require('../controllers/submissionController');
const { protect, optionalAuth, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', competitionController.getCompetitions);
router.get('/:id', optionalAuth, competitionController.getCompetitionById);
router.get('/:id/status', optionalAuth, competitionController.getCompetitionStatus);
router.get('/:id/winners', competitionController.getWinners);
router.get('/:id/rewards', competitionController.getRewards);

router.post('/:id/register', protect, registrationController.registerForCompetition);
router.get('/:id/registration', protect, registrationController.getRegistration);
router.delete('/:id/registration', protect, registrationController.cancelRegistration);

router.post('/:id/submission', protect, upload.single('file'), submissionController.createSubmission);
router.get('/:id/submission', protect, submissionController.getSubmission);
router.get('/:id/submissions', protect, authorize('ADMIN', 'JUDGE'), submissionController.getCompetitionSubmissions);

router.post('/', protect, authorize('ADMIN'), competitionController.createCompetition);
router.put('/:id', protect, authorize('ADMIN'), competitionController.updateCompetition);

module.exports = router;
