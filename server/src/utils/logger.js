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
  }

  formatMessage(level, message, emoji = '') {
    const timestamp = new Date().toLocaleTimeString();
    return `[${timestamp}] ${emoji} ${level}: ${message}`;
  }

  info(message, emoji = 'ℹ️') {
    console.log(this.colors.blue + this.formatMessage('INFO', message, emoji) + this.colors.reset);
  }

  success(message, emoji = '✅') {
    console.log(this.colors.green + this.formatMessage('SUCCESS', message, emoji) + this.colors.reset);
  }

  warning(message, emoji = '⚠️') {
    console.log(this.colors.yellow + this.formatMessage('WARNING', message, emoji) + this.colors.reset);
  }

  error(message, emoji = '❌') {
    console.error(this.colors.red + this.formatMessage('ERROR', message, emoji) + this.colors.reset);
  }

  debug(message, emoji = '🐛') {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.log(this.colors.magenta + this.formatMessage('DEBUG', message, emoji) + this.colors.reset);
    }
  }

  campaign(message, emoji = '📧') {
    console.log(this.colors.cyan + this.formatMessage('CAMPAIGN', message, emoji) + this.colors.reset);
  }

  email(message, emoji = '📨') {
    console.log(this.colors.green + this.formatMessage('EMAIL', message, emoji) + this.colors.reset);
  }

  file(message, emoji = '📁') {
    console.log(this.colors.blue + this.formatMessage('FILE', message, emoji) + this.colors.reset);
  }
}

module.exports = new Logger();
