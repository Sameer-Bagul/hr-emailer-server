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
  }

  // Set socket handler for real-time log emission
  setSocketHandler(socketHandler) {
    this.socketHandler = socketHandler;
  }

  formatMessage(level, message, emoji = '') {
    const timestamp = new Date().toLocaleTimeString();
    return `[${timestamp}] ${emoji} ${level}: ${message}`;
  }

  emitToSocket(level, message, emoji = '') {
    if (this.socketHandler && this.socketHandler.emitGeneralNotification) {
      try {
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
  }

  success(message, emoji = '✅') {
    console.log(this.colors.green + this.formatMessage('SUCCESS', message, emoji) + this.colors.reset);
    this.emitToSocket('SUCCESS', message, emoji);
  }

  warning(message, emoji = '⚠️') {
    console.log(this.colors.yellow + this.formatMessage('WARNING', message, emoji) + this.colors.reset);
    this.emitToSocket('WARNING', message, emoji);
  }

  error(message, emoji = '❌') {
    console.error(this.colors.red + this.formatMessage('ERROR', message, emoji) + this.colors.reset);
    this.emitToSocket('ERROR', message, emoji);
  }

  debug(message, emoji = '🐛') {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.log(this.colors.magenta + this.formatMessage('DEBUG', message, emoji) + this.colors.reset);
      this.emitToSocket('DEBUG', message, emoji);
    }
  }

  campaign(message, emoji = '📧') {
    console.log(this.colors.cyan + this.formatMessage('CAMPAIGN', message, emoji) + this.colors.reset);
    this.emitToSocket('CAMPAIGN', message, emoji);
  }

  email(message, emoji = '📨') {
    console.log(this.colors.green + this.formatMessage('EMAIL', message, emoji) + this.colors.reset);
    this.emitToSocket('EMAIL', message, emoji);
  }

  file(message, emoji = '📁') {
    console.log(this.colors.blue + this.formatMessage('FILE', message, emoji) + this.colors.reset);
    this.emitToSocket('FILE', message, emoji);
  }
}

module.exports = new Logger();
