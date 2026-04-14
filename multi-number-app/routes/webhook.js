const express = require('express');
const { handleIncomingMessage, handleWebhookVerification } = require('../middleware/webhookHandler');

const router = express.Router();

router.get('/webhook', handleWebhookVerification);
router.post('/webhook', handleIncomingMessage);

module.exports = router;