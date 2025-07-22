const nodemailer = require('nodemailer');

class EmailConfig {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL,
          pass: process.env.EMAIL_PASS
        }
      });

      console.log('📧 Email transporter initialized');
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
      await this.transporter.verify();
      console.log('✅ Email connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email connection verification failed:', error);
      return false;
    }
  }
}

module.exports = new EmailConfig();
