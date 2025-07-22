const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));
    
    logger.warning(`Validation errors in ${req.method} ${req.path}:`, errorMessages);
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errorMessages
    });
  }
  
  next();
};

// Campaign validation rules
const validateCampaignCreation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Campaign name must be between 1 and 100 characters'),
  
  body('subject')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Email subject must be between 1 and 200 characters'),
  
  body('template')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Email template must be at least 10 characters long'),
  
  body('senderName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Sender name must be between 1 and 50 characters'),
  
  body('senderEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Sender email must be a valid email address'),
  
  body('dailyLimit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Daily limit must be between 1 and 1000'),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  handleValidationErrors
];

const validateCampaignUpdate = [
  param('id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Campaign ID is required'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Campaign name must be between 1 and 100 characters'),
  
  body('subject')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Email subject must be between 1 and 200 characters'),
  
  body('template')
    .optional()
    .trim()
    .isLength({ min: 10 })
    .withMessage('Email template must be at least 10 characters long'),
  
  body('dailyLimit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Daily limit must be between 1 and 1000'),
  
  handleValidationErrors
];

// Email validation rules
const validateEmailSend = [
  body('to')
    .isEmail()
    .normalizeEmail()
    .withMessage('Recipient email must be a valid email address'),
  
  body('subject')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Email subject must be between 1 and 200 characters'),
  
  body('content')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Email content must be at least 10 characters long'),
  
  body('from')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Sender email must be a valid email address'),
  
  handleValidationErrors
];

const validateBulkEmail = [
  body('campaignId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Campaign ID is required'),
  
  body('batchSize')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Batch size must be between 1 and 100'),
  
  handleValidationErrors
];

// Template validation rules
const validateTemplate = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Template name must be between 1 and 100 characters'),
  
  body('content')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Template content must be at least 10 characters long'),
  
  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array'),
  
  handleValidationErrors
];

// ID parameter validation
const validateId = [
  param('id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('ID parameter is required'),
  
  handleValidationErrors
];

// Query parameter validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  
  handleValidationErrors
];

// Custom validation helpers
const validateDateNotInPast = (value) => {
  if (value && new Date(value) < new Date()) {
    throw new Error('Date cannot be in the past');
  }
  return true;
};

const validateEndDateAfterStart = (req) => {
  const { startDate, endDate } = req.body;
  if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
    throw new Error('End date must be after start date');
  }
  return true;
};

module.exports = {
  validateCampaignCreation,
  validateCampaignUpdate,
  validateEmailSend,
  validateBulkEmail,
  validateTemplate,
  validateId,
  validatePagination,
  validateDateRange,
  handleValidationErrors,
  validateDateNotInPast,
  validateEndDateAfterStart
};
