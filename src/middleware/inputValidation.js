const { body, param, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warning(`Validation failed for ${req.method} ${req.path}: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Campaign validation rules
const validateCampaignCreation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Campaign name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Campaign name contains invalid characters'),
  
  body('emails')
    .isArray({ min: 1 })
    .withMessage('At least one email is required'),
  
  body('emails.*.to')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),
  
  body('emails.*.companyName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Company name must be between 1 and 100 characters'),
  
  validateRequest
];

// Email validation rules
const validateEmailSending = [
  body('to')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid recipient email'),
  
  body('subject')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Subject must be between 1 and 200 characters'),
  
  body('content')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Email content is required'),
  
  validateRequest
];

// Campaign ID validation
const validateCampaignId = [
  param('id')
    .matches(/^camp_[0-9]+_[a-z0-9]+$/)
    .withMessage('Invalid campaign ID format'),
  
  validateRequest
];

// Template validation
const validateTemplate = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Template name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Template name contains invalid characters'),
  
  body('content')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Template content is required'),
  
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject must be less than 200 characters'),
  
  validateRequest
];

// Sanitize HTML content
const sanitizeHtml = (req, res, next) => {
  if (req.body && req.body.content) {
    // Remove potentially dangerous HTML
    req.body.content = req.body.content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/onload\s*=/gi, '')
      .replace(/onerror\s*=/gi, '');
  }
  next();
};

module.exports = {
  validateRequest,
  validateCampaignCreation,
  validateEmailSending,
  validateCampaignId,
  validateTemplate,
  sanitizeHtml
};
