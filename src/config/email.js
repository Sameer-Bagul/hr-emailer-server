const nodemailer = require('nodemailer');

class EmailConfig {
  constructor() {
    this.transporter = null;
    this.isVerified = false;
    this.lastVerification = 0;
    this.verificationInterval = 10 * 60 * 1000; // 10 minutes
    this.connectionPool = true; // Enable connection pooling
    this.maxConnections = 5; // Maximum simultaneous connections
    this.maxMessages = 100; // Messages per connection before reconnecting
    
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Validate required environment variables
      if (!process.env.EMAIL || !process.env.EMAIL_PASS) {
        throw new Error('EMAIL and EMAIL_PASS environment variables are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(process.env.EMAIL)) {
        throw new Error('Invalid EMAIL environment variable format');
      }

      // Use explicit SMTP configuration for better reliability with connection pooling
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        pool: this.connectionPool, // Enable connection pooling
        maxConnections: this.maxConnections,
        maxMessages: this.maxMessages,
        rateDelta: 1000, // Rate limiting: 1 second between messages
        rateLimit: 5, // Maximum 5 messages per rateDelta
        auth: {
          user: process.env.EMAIL,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: true, // Enforce certificate validation
          minVersion: 'TLSv1.2', // Minimum TLS version
          ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA' // Secure cipher suites
        },
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000, // 30 seconds
        socketTimeout: 60000 // 60 seconds
      });

      console.log('📧 Email transporter initialized with secure SMTP configuration');
      console.log('📧 SMTP Host:', process.env.SMTP_HOST || 'smtp.gmail.com');
      console.log('📧 SMTP Port:', process.env.SMTP_PORT || 587);
      console.log('📧 Using email: ***REDACTED***');
      console.log('📧 Connection pooling:', this.connectionPool ? 'Enabled' : 'Disabled');
      console.log('📧 TLS Security: Enforced with TLSv1.2+');
    } catch (error) {
      console.error('❌ Error initializing email transporter:', error);
    }
  }

  getTransporter() {
    if (!this.transporter) {
      this.initializeTransporter();
    }
    return this.transporter;
  }

  async verifyConnection() {
    try {
      const now = Date.now();

      // Check if we need to re-verify
      if (this.isVerified && (now - this.lastVerification) < this.verificationInterval) {
        return { success: true, message: 'Connection already verified' };
      }

      await this.transporter.verify();
      console.log('✅ Email connection verified');

      this.isVerified = true;
      this.lastVerification = now;
      return { success: true, message: 'Email connection verified successfully' };
    } catch (error) {
      console.error('❌ Email connection verification failed:', error.message);
      this.isVerified = false;

      // Categorize verification errors
      let errorType = 'UNKNOWN';
      const errorMsg = error.message.toLowerCase();

      if (errorMsg.includes('authentication') || errorMsg.includes('credentials')) {
        errorType = 'AUTHENTICATION';
      } else if (errorMsg.includes('connection') || errorMsg.includes('network')) {
        errorType = 'NETWORK';
      } else if (errorMsg.includes('tls') || errorMsg.includes('certificate')) {
        errorType = 'TLS';
      }

      // Reinitialize transporter on verification failure
      try {
        this.initializeTransporter();
      } catch (initError) {
        console.error('❌ Failed to reinitialize transporter:', initError.message);
      }

      return {
        success: false,
        error: this.getSafeVerificationError(errorType, error),
        errorType
      };
    }
  }

  // Get safe verification error messages
  getSafeVerificationError(errorType, originalError) {
    switch (errorType) {
      case 'AUTHENTICATION':
        return 'Authentication failed. Please check your email credentials.';
      case 'NETWORK':
        return 'Network connection failed. Please check your internet connection.';
      case 'TLS':
        return 'TLS/SSL connection failed. Please check your security settings.';
      default:
        return 'Connection verification failed. Please check your email configuration.';
    }
  }

  // Close connections gracefully
  close() {
    if (this.transporter) {
      this.transporter.close();
      console.log('📧 Email transporter connections closed');
    }
  }

  // Get connection statistics
  getStats() {
    if (this.transporter && this.transporter.pool) {
      return {
        verified: this.isVerified,
        lastVerification: new Date(this.lastVerification),
        pooling: this.connectionPool,
        maxConnections: this.maxConnections,
        maxMessages: this.maxMessages
      };
    }
    return { verified: this.isVerified };
  }
}

module.exports = new EmailConfig();
