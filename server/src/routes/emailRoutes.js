const express = require('express');
const EmailController = require('../controllers/emailController');
const { campaignUpload } = require('../middleware/uploadMiddleware');
const { validateEmailSend, validateBulkEmail, validatePagination } = require('../middleware/validation');

const router = express.Router();

// Create controller instance
const emailController = new EmailController();

// Send emails (supports both single and bulk)
router.post('/send', campaignUpload, emailController.sendEmails.bind(emailController));

// Verify email configuration
router.post('/verify', emailController.verifyEmailConfig.bind(emailController));

// Estimate sending time
router.post('/estimate', emailController.estimateSendingTime.bind(emailController));

module.exports = router;
