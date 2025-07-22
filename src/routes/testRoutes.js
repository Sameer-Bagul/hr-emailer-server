const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Test simple email sending
router.post('/test-email', async (req, res) => {
  try {
    const EmailService = require('../services/emailService');
    const emailService = new EmailService();
    
    const testEmail = {
      to: req.body.to || 'test@example.com',
      subject: req.body.subject || 'HR Emailer Test Email',
      html: `
        <h2>🧪 Test Email from HR Emailer</h2>
        <p>This is a test email to verify your email configuration is working.</p>
        <p><strong>Server:</strong> ${req.get('host')}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p>If you received this email, your SMTP configuration is working correctly! ✅</p>
      `,
      from: process.env.SMTP_FROM_EMAIL || 'noreply@hr-emailer.com'
    };

    logger.info(`🧪 Testing email configuration - sending to ${testEmail.to}`);
    
    const result = await emailService.sendEmail(testEmail);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Test email sent successfully to ${testEmail.to}`,
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to send test email'
      });
    }
  } catch (error) {
    logger.error(`Error sending test email: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Check email configuration
router.get('/check-email-config', (req, res) => {
  try {
    const config = {
      smtp_host: process.env.SMTP_HOST || 'NOT_SET',
      smtp_port: process.env.SMTP_PORT || 'NOT_SET',
      smtp_secure: process.env.SMTP_SECURE || 'NOT_SET',
      smtp_user: process.env.SMTP_USER ? 'SET' : 'NOT_SET',
      smtp_pass: process.env.SMTP_PASS ? 'SET' : 'NOT_SET',
      smtp_from: process.env.SMTP_FROM_EMAIL || 'NOT_SET',
      client_url: process.env.CLIENT_URL || 'NOT_SET',
      node_env: process.env.NODE_ENV || 'NOT_SET'
    };

    const missingVars = Object.entries(config)
      .filter(([key, value]) => value === 'NOT_SET')
      .map(([key]) => key.toUpperCase());

    res.json({
      config,
      missing_variables: missingVars,
      all_configured: missingVars.length === 0,
      recommendations: missingVars.length > 0 ? [
        'Set missing environment variables in your Render dashboard',
        'For Gmail: Use App Password instead of regular password',
        'Restart your service after setting variables'
      ] : ['Email configuration looks good!']
    });
  } catch (error) {
    logger.error(`Error checking email config: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Test completion notification
router.post('/test-completion/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const schedulerService = req.app.get('schedulerService');
    
    if (!schedulerService) {
      return res.status(500).json({ error: 'Scheduler service not available' });
    }

    const result = await schedulerService.testCompletionNotification(campaignId);
    
    res.json({
      success: true,
      message: `Completion notification test sent for campaign ${campaignId}`,
      result
    });
  } catch (error) {
    logger.error(`Error testing completion notification: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Test daily report
router.post('/test-daily-report', async (req, res) => {
  try {
    const schedulerService = req.app.get('schedulerService');
    
    if (!schedulerService) {
      return res.status(500).json({ error: 'Scheduler service not available' });
    }

    const result = await schedulerService.testDailyReport();
    
    res.json({
      success: true,
      message: 'Daily report test sent',
      ...result
    });
  } catch (error) {
    logger.error(`Error testing daily report: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger evening report
router.post('/trigger-evening-report', async (req, res) => {
  try {
    const schedulerService = req.app.get('schedulerService');
    
    if (!schedulerService) {
      return res.status(500).json({ error: 'Scheduler service not available' });
    }

    await schedulerService.sendEveningStatusReport();
    
    res.json({
      success: true,
      message: 'Evening status report triggered successfully'
    });
  } catch (error) {
    logger.error(`Error triggering evening report: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
