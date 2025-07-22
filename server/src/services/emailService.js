const Email = require('../models/Email');
const Template = require('../models/Template');
const emailConfig = require('../config/email');
const logger = require('../utils/logger');
const FileUtils = require('../utils/fileUtils');

class EmailService {
  constructor() {
    this.transporter = emailConfig.getTransporter();
  }

  // Send a single email
  async sendEmail(emailData) {
    try {
      const email = new Email(emailData);
      
      // Validate email
      const validation = email.isValid();
      if (!validation.valid) {
        throw new Error(`Email validation failed: ${validation.errors.join(', ')}`);
      }

      // Convert to nodemailer format
      const mailOptions = email.toNodemailerFormat();
      
      logger.email(`Sending email to ${email.to} (${email.companyName || 'Unknown Company'})`);
      
      // Send email
      const result = await this.transporter.sendMail(mailOptions);
      
      logger.email(`Email sent successfully to ${email.to} - MessageID: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId,
        recipient: email.to,
        companyName: email.companyName,
        logEntry: email.createLogEntry({ success: true, messageId: result.messageId })
      };
    } catch (error) {
      logger.error(`Failed to send email to ${emailData.to}: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        recipient: emailData.to,
        companyName: emailData.companyName,
        logEntry: new Email(emailData).createLogEntry({ success: false, error: error.message })
      };
    }
  }

  // Send batch of emails with delay
  async sendEmailBatch(emails, delayMs = 10000, onProgress = null) {
    const results = {
      total: emails.length,
      successful: 0,
      failed: 0,
      details: []
    };

    logger.email(`Starting batch email sending: ${emails.length} emails with ${delayMs}ms delay`);

    for (let i = 0; i < emails.length; i++) {
      const emailData = emails[i];
      
      try {
        // Send email
        const result = await this.sendEmail(emailData);
        
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
        }
        
        results.details.push(result);

        // Call progress callback if provided
        if (onProgress && typeof onProgress === 'function') {
          onProgress({
            current: i + 1,
            total: emails.length,
            successful: results.successful,
            failed: results.failed,
            currentEmail: result
          });
        }

        // Add delay between emails (except for the last one)
        if (i < emails.length - 1) {
          logger.debug(`Waiting ${delayMs}ms before next email...`);
          await this.delay(delayMs);
        }
      } catch (error) {
        logger.error(`Unexpected error in batch processing: ${error.message}`);
        results.failed++;
        
        results.details.push({
          success: false,
          error: error.message,
          recipient: emailData.to,
          companyName: emailData.companyName
        });
      }
    }

    logger.email(`Batch email sending completed: ${results.successful} successful, ${results.failed} failed`);
    return results;
  }

  // Create email from template
  createEmailFromTemplate(template, recipient, templateVariables = {}) {
    try {
      // Prepare template variables
      const variables = {
        company_name: recipient.company_name || recipient.companyName,
        email: recipient.email,
        ...templateVariables
      };

      // Render template
      const rendered = template.render(variables);
      if (!rendered) {
        throw new Error('Template rendering failed');
      }

      // Create email object
      const emailData = {
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.content,
        companyName: variables.company_name,
        templateVariables: variables
      };

      return new Email(emailData);
    } catch (error) {
      logger.error(`Failed to create email from template: ${error.message}`);
      return null;
    }
  }

  // Prepare emails from campaign data
  prepareEmailsFromCampaign(campaign, recipients = null) {
    try {
      // Load template
      const template = new Template({
        content: campaign.template,
        subject: campaign.subject
      });

      const contacts = recipients || campaign.contacts;
      const emails = [];

      for (const contact of contacts) {
        const email = this.createEmailFromTemplate(template, contact);
        if (email) {
          // Add attachments if available
          if (campaign.attachments && campaign.attachments.length > 0) {
            campaign.attachments.forEach(att => {
              email.addAttachment(att);
            });
          }

          // Add resume doc link to email content if available
          if (campaign.resumeDocLink) {
            const resumeSection = `
              <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #667eea;">
                <p style="margin: 0; font-size: 14px; color: #333;">
                  <strong>📄 Resume:</strong> 
                  <a href="${campaign.resumeDocLink}" target="_blank" style="color: #667eea; text-decoration: none;">
                    View my complete resume and portfolio
                  </a>
                </p>
              </div>`;
            
            email.html += resumeSection;
          }

          emails.push(email);
        }
      }

      logger.email(`Prepared ${emails.length} emails from campaign data`);
      return emails;
    } catch (error) {
      logger.error(`Failed to prepare emails from campaign: ${error.message}`);
      return [];
    }
  }

  // Verify email configuration
  async verifyConfiguration() {
    try {
      await emailConfig.verifyConnection();
      return { success: true, message: 'Email configuration verified successfully' };
    } catch (error) {
      logger.error(`Email configuration verification failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Utility function to add delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Estimate email sending time
  estimateSendingTime(emailCount, delayMs = 10000) {
    const totalTimeMs = (emailCount - 1) * delayMs; // No delay after last email
    const totalTimeMinutes = Math.ceil(totalTimeMs / 60000);
    
    return {
      totalTimeMs,
      totalTimeMinutes,
      estimatedCompletion: new Date(Date.now() + totalTimeMs),
      breakdown: {
        emails: emailCount,
        delayBetweenEmails: `${delayMs / 1000} seconds`,
        totalDelayTime: `${totalTimeMinutes} minutes`
      }
    };
  }

  // Clean up attachments after sending
  cleanupAttachments(emails) {
    const cleanedFiles = [];
    
    emails.forEach(email => {
      if (email.attachments && email.attachments.length > 0) {
        email.attachments.forEach(attachment => {
          if (attachment.path && FileUtils.deleteFile(attachment.path)) {
            cleanedFiles.push(attachment.filename);
          }
        });
      }
    });

    if (cleanedFiles.length > 0) {
      logger.file(`Cleaned up ${cleanedFiles.length} attachment files`);
    }
  }

  // Send batch of emails for a specific campaign
  async sendCampaignBatch(campaignId, batchSize, onProgress = null) {
    try {
      // Get campaign service (we'll need to import it)
      const CampaignService = require('./campaignService');
      const campaignService = new CampaignService();
      
      const campaign = campaignService.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Get next batch of contacts that haven't been sent yet
      const nextBatch = campaignService.getNextBatch(campaignId);
      if (!nextBatch || !nextBatch.contacts || nextBatch.contacts.length === 0) {
        logger.info(`No more emails to send for campaign ${campaignId}`);
        return { success: true, sent: 0, message: 'No pending emails' };
      }

      // Limit batch size
      const actualBatch = nextBatch.contacts.slice(0, batchSize);
      
      // Prepare emails from campaign and batch contacts
      const emails = this.prepareEmailsFromCampaign(campaign, actualBatch);
      
      // Send the batch
      const result = await this.sendEmailBatch(emails, campaign.delay, onProgress);
      
      // Update campaign progress
      campaignService.updateCampaignProgress(campaignId, result.successful, result.failed);
      
      logger.email(`Campaign ${campaignId}: Sent ${result.successful}/${result.total} emails in batch`);
      
      return {
        success: true,
        sent: result.successful,
        failed: result.failed,
        total: result.total
      };
      
    } catch (error) {
      logger.error(`Error sending campaign batch ${campaignId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = EmailService;
