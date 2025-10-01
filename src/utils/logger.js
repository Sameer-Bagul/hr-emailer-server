const FileLogger = require('./fileLogger');

class Logger {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };
    this.socketHandler = null;
    this.fileLogger = new FileLogger({
      logLevel: process.env.LOG_LEVEL || 'info',
      ttlDays: parseInt(process.env.LOG_TTL_DAYS) || 90
    });

    // Start periodic cleanup
    this.fileLogger.startCleanup();
  }

  // Set socket handler for real-time log emission
  setSocketHandler(socketHandler) {
    this.socketHandler = socketHandler;
  }

  // Save log to file
  async saveLogToFile(level, message, category = 'system', data = {}) {
    try {
      // Add memory usage for performance monitoring
      if (process.memoryUsage) {
        data.memoryUsage = {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        };
      }

      await this.fileLogger.log(level, message, category, data);
    } catch (error) {
      // Prevent infinite logging loops - don't log file errors
      console.error('Failed to save log to file:', error.message);
    }
  }

  // Sanitize message to prevent sensitive data leakage
  sanitizeMessage(message) {
    if (typeof message !== 'string') {
      return message;
    }

    // Remove potential sensitive patterns
    const sensitivePatterns = [
      /password[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{8,})/gi,
      /token[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{20,})/gi,
      /key[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{16,})/gi,
      /secret[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{16,})/gi,
      /api_key[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{16,})/gi,
      /auth[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{16,})/gi
    ];

    let sanitized = message;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, (match, captured) => {
        return match.replace(captured, '***REDACTED***');
      });
    });

    return sanitized;
  }

  formatMessage(level, message, emoji = '') {
    const timestamp = new Date().toLocaleTimeString();
    const sanitizedMessage = this.sanitizeMessage(message);
    return `[${timestamp}] ${emoji} ${level}: ${sanitizedMessage}`;
  }

  emitToSocket(level, message, emoji = '') {
    if (this.socketHandler && this.socketHandler.emitGeneralNotification) {
      try {
        // Prevent infinite loops by not emitting socket notifications for socket-related logs
        if (message.includes('Emitted general notification') || message.includes('serverLog')) {
          return;
        }
        
        this.socketHandler.emitGeneralNotification('serverLog', {
          level: level.toLowerCase(),
          message: this.formatMessage(level, message, emoji),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        // Silently fail to avoid circular logging
      }
    }
  }

  info(message, emoji = 'ℹ️') {
    console.log(this.colors.blue + this.formatMessage('INFO', message, emoji) + this.colors.reset);
    this.emitToSocket('INFO', message, emoji);
    this.saveLogToFile('info', message, 'system');
  }

  success(message, emoji = '✅') {
    console.log(this.colors.green + this.formatMessage('SUCCESS', message, emoji) + this.colors.reset);
    this.emitToSocket('SUCCESS', message, emoji);
    this.saveLogToFile('info', message, 'system');
  }

  warn(message, emoji = '⚠️') {
    console.log(this.colors.yellow + this.formatMessage('WARNING', message, emoji) + this.colors.reset);
    this.emitToSocket('WARNING', message, emoji);
    this.saveLogToFile('warn', message, 'system');
  }

  warning(message, emoji = '⚠️') {
    this.warn(message, emoji);
  }

  error(message, emoji = '❌') {
    console.error(this.colors.red + this.formatMessage('ERROR', message, emoji) + this.colors.reset);
    this.emitToSocket('ERROR', message, emoji);
    this.saveLogToFile('error', message, 'system');
  }

  debug(message, emoji = '🐛') {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.log(this.colors.magenta + this.formatMessage('DEBUG', message, emoji) + this.colors.reset);
      this.emitToSocket('DEBUG', message, emoji);
      this.saveLogToFile('debug', message, 'system');
    }
  }

  campaign(message, emoji = '📧') {
    console.log(this.colors.cyan + this.formatMessage('CAMPAIGN', message, emoji) + this.colors.reset);
    this.emitToSocket('CAMPAIGN', message, emoji);
    this.saveLogToFile('info', message, 'campaign');
  }

  email(message, emoji = '📨') {
    console.log(this.colors.green + this.formatMessage('EMAIL', message, emoji) + this.colors.reset);
    this.emitToSocket('EMAIL', message, emoji);
    this.saveLogToFile('info', message, 'email');
  }

  file(message, emoji = '📁') {
    console.log(this.colors.blue + this.formatMessage('FILE', message, emoji) + this.colors.reset);
    this.emitToSocket('FILE', message, emoji);
    this.saveLogToFile('info', message, 'system');
  }

  // Query methods
  async queryLogs(options = {}) {
    return await this.fileLogger.query(options);
  }

  async getLogsByLevel(level, limit = 100) {
    return await this.queryLogs({ level, limit });
  }

  async getLogsByCategory(category, limit = 100) {
    return await this.queryLogs({ category, limit });
  }

  async getRecentLogs(limit = 100) {
    return await this.queryLogs({ limit });
  }

  async getErrorLogs(limit = 100) {
    return await this.getLogsByLevel('error', limit);
  }

  async getLogsByDateRange(startDate, endDate, category = null, limit = 100) {
    return await this.queryLogs({ startDate, endDate, category, limit });
  }

  async getLogStats() {
    return await this.fileLogger.getStats();
  }

  async cleanupOldLogs() {
    return await this.fileLogger.cleanupOldLogs();
  }
}

module.exports = new Logger();
