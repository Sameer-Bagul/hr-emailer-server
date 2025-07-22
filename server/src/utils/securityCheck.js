const logger = require('../utils/logger');

class ProductionSecurityCheck {
  constructor() {
    this.requiredEnvVars = [
      'NODE_ENV',
      'PORT',
      'CLIENT_URL',
      'EMAIL',
      'EMAIL_PASS'
    ];
    
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  // Check all required environment variables
  validateEnvironment() {
    const missing = [];
    const warnings = [];

    this.requiredEnvVars.forEach(varName => {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    });

    // Check for production-specific requirements
    if (this.isProduction) {
      if (process.env.CLIENT_URL && process.env.CLIENT_URL.includes('localhost')) {
        warnings.push('CLIENT_URL should not contain localhost in production');
      }

      if (process.env.EMAIL && process.env.EMAIL.includes('test')) {
        warnings.push('EMAIL appears to be a test email in production');
      }

      if (!process.env.MAIN_USER_EMAIL) {
        warnings.push('MAIN_USER_EMAIL not set - daily reports will not be sent');
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      warnings
    };
  }

  // Validate email configuration
  validateEmailConfig() {
    const issues = [];

    if (!process.env.EMAIL || !process.env.EMAIL.includes('@')) {
      issues.push('EMAIL must be a valid email address');
    }

    if (!process.env.EMAIL_PASS || process.env.EMAIL_PASS.length < 16) {
      issues.push('EMAIL_PASS should be a 16-character Gmail App Password');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  // Run all security checks
  runSecurityChecks() {
    logger.info('🔍 Running production security checks...');

    const envCheck = this.validateEnvironment();
    const emailCheck = this.validateEmailConfig();

    // Log results
    if (!envCheck.valid) {
      logger.error(`❌ Missing environment variables: ${envCheck.missing.join(', ')}`);
      return false;
    }

    if (envCheck.warnings.length > 0) {
      envCheck.warnings.forEach(warning => {
        logger.warning(`⚠️ ${warning}`);
      });
    }

    if (!emailCheck.valid) {
      emailCheck.issues.forEach(issue => {
        logger.error(`❌ Email configuration issue: ${issue}`);
      });
      return false;
    }

    logger.info('✅ All security checks passed');
    return true;
  }

  // Check if sensitive data is exposed
  checkForLeaks() {
    const warnings = [];

    // Check if .env file might be exposed
    if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_PASS) {
      warnings.push('Ensure .env file is in .gitignore');
    }

    // Check for default passwords
    if (process.env.EMAIL_PASS && process.env.EMAIL_PASS.includes('password')) {
      warnings.push('EMAIL_PASS appears to be a default password');
    }

    return warnings;
  }
}

module.exports = new ProductionSecurityCheck();
