const logger = require('../utils/logger');

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error(`Error in ${req.method} ${req.path}: ${err.message}`);
  
  // Don't leak error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: 'File size cannot exceed the allowed limit'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file',
      message: 'Unexpected file field in upload'
    });
  }

  // File type errors
  if (err.message.includes('Only Excel files are allowed')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'Only Excel files (.xlsx, .xls) are allowed for contact list'
    });
  }

  if (err.message.includes('Only PDF files are allowed')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'Only PDF files are allowed for resume'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message
    });
  }

  // Database errors
  if (err.name === 'DatabaseError') {
    return res.status(500).json({
      error: 'Database error',
      message: 'An error occurred while accessing the database'
    });
  }

  // Email service errors
  if (err.message.includes('Authentication failed')) {
    return res.status(500).json({
      error: 'Email configuration error',
      message: 'Email authentication failed. Please check your email configuration.'
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An internal server error occurred'
    : err.message;

  res.status(statusCode).json({
    error: 'Server error',
    message
  });
};

// 404 handler
const notFoundHandler = (req, res) => {
  logger.warning(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 400 ? 'red' : 'green';
    
    logger.info(
      `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`,
      '🌐'
    );
  });

  next();
};

module.exports = {
  errorHandler,
  notFoundHandler,
  requestLogger
};
