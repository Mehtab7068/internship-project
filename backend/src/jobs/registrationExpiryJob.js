const cron = require('node-cron');
const registrationService = require('../services/registrationService');

const startRegistrationExpiryJob = () => {
    // Every minute: expire stale pending_payment reservations and release spots
    cron.schedule('* * * * *', async () => {
        try {
            const expired = await registrationService.expireStaleRegistrations();
            if (expired > 0) {
                console.log(`⏰ Registration expiry job: expired ${expired} reservation(s) and released their spots`);
            }
        } catch (err) {
            console.error('Registration expiry job failed:', err.message);
        }
    });
    console.log('⏰ Registration expiry job scheduled (every minute)');
};

module.exports = { startRegistrationExpiryJob };