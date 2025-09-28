const express = require('express');
const EmailController = require('../controllers/emailController');
const { campaignUpload } = require('../middleware/uploadMiddleware');
const { validateEmailSend, validateBulkEmail, validatePagination } = require('../middleware/validation');
const { securityHeaders, emailRateLimit, sanitizeInput } = require('../middleware/security');

const router = express.Router();

// Apply security middleware to all email routes
router.use(securityHeaders);
router.use(emailRateLimit);
router.use(sanitizeInput);

// Create controller instance
const emailController = new EmailController();

// Send emails (supports both single and bulk)
router.post('/send', campaignUpload, emailController.sendEmails.bind(emailController));

// Verify email configuration
router.post('/verify', emailController.verifyEmailConfig.bind(emailController));

// Estimate sending time
router.post('/estimate', emailController.estimateSendingTime.bind(emailController));

// Get email logs
router.get('/logs', emailController.getLogs.bind(emailController));

// Get rate limit status
router.get('/rate-limit', emailController.getRateLimitStatus.bind(emailController));

// Get batch processing configuration
router.get('/batch-config', emailController.getBatchConfig.bind(emailController));

module.exports = router;
