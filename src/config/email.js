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
      // Use explicit SMTP configuration for better reliability with connection pooling
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for other ports
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
          rejectUnauthorized: false
        },
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000, // 30 seconds
        socketTimeout: 60000 // 60 seconds
      });

      console.log('📧 Email transporter initialized with SMTP configuration');
      console.log('📧 Using email:', process.env.EMAIL ? 'Configured' : 'Not configured');
      console.log('📧 Using password:', process.env.EMAIL_PASS ? 'Configured' : 'Not configured');
      console.log('📧 Connection pooling:', this.connectionPool ? 'Enabled' : 'Disabled');
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
        return true;
      }
      
      await this.transporter.verify();
      console.log('✅ Email connection verified');
      
      this.isVerified = true;
      this.lastVerification = now;
      return true;
    } catch (error) {
      console.error('❌ Email connection verification failed:', error);
      this.isVerified = false;
      
      // Reinitialize transporter on verification failure
      this.initializeTransporter();
      return false;
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
