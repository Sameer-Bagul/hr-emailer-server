const winston = require('winston');
const path = require('path');

// Create logs directory path
const logsDir = path.join(__dirname, '../../logs');

// Define log format for successful emails
const successfulEmailFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Ensure no sensitive information is logged
    const sanitizedMeta = sanitizeLogData(meta);
    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      message,
      ...sanitizedMeta
    });
  })
);

// Sanitize log data to remove sensitive information
function sanitizeLogData(data) {
  const sanitized = { ...data };

  // Remove or redact sensitive fields
  const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth', 'api_key', 'credentials'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });

  // Ensure email content doesn't contain sensitive data
  if (sanitized.html) {
    // Remove any potential script tags or sensitive patterns
    sanitized.html = sanitized.html.replace(/<script[^>]*>.*?<\/script>/gi, '[SCRIPT REMOVED]');
    sanitized.html = sanitized.html.replace(/password\s*[:=]\s*[^&\s]+/gi, 'password=***REDACTED***');
    sanitized.html = sanitized.html.replace(/token\s*[:=]\s*[^&\s]+/gi, 'token=***REDACTED***');
  }

  return sanitized;
}

// Create winston logger for successful emails
const successfulEmailLogger = winston.createLogger({
  level: 'info',
  format: successfulEmailFormat,
  transports: [
    // Write to successful-emails.log file
    new winston.transports.File({
      filename: path.join(logsDir, 'successful-emails.log'),
      level: 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5, // Keep 5 rotated files
      tailable: true,
      format: successfulEmailFormat
    }),

    // Also log to console in development
    ...(process.env.NODE_ENV === 'development' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          successfulEmailFormat
        )
      })
    ] : [])
  ],
  // Don't exit on error
  exitOnError: false
});

// Handle transport errors
successfulEmailLogger.transports.forEach(transport => {
  transport.on('error', (error) => {
    console.error('Successful email logger transport error:', error);
  });
});

module.exports = successfulEmailLogger;