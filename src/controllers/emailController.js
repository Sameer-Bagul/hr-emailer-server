const EmailService = require('../services/emailService');
const CampaignService = require('../services/campaignService');
const FileService = require('../services/fileService');
const logger = require('../utils/logger');
const Template = require('../models/Template');

class EmailController {
  constructor() {
    this.emailService = new EmailService();
    this.campaignService = new CampaignService();
    this.fileService = new FileService();
  }
  // POST /api/send-emails - Send emails (immediate or campaign)
  async sendEmails(req, res) {
    try {
      logger.email('Email sending endpoint called');
      
      const { delayMs, resumeDocLink, userEmail, campaignType } = req.body;
      const files = req.files;
      const excelFile = files?.file?.[0];
      const resumeFile = files?.resume?.[0];

      // Validate Excel file
      if (!excelFile) {
        return res.status(400).json({ error: 'No Excel file uploaded' });
      }

      // Parse Excel file
      const parseResult = await this.fileService.parseExcelFile(excelFile.path);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error });
      }

      const recipients = parseResult.recipients;
      if (recipients.length === 0) {
        return res.status(400).json({ error: 'No valid recipients found in Excel file' });
      }

      // Load template
      const template = Template.loadDefaultTemplate();
      if (!template) {
        return res.status(500).json({ error: 'Failed to load email template' });
      }

      // Convert recipients to campaign format
      const contacts = recipients.map(r => ({
        email: r.email,
        company_name: r.company_name
      }));

      // Check if this should be a multi-day campaign
      if (campaignType === 'multi-day' || contacts.length > 1) {
        logger.campaign('Creating multi-day campaign...');
        
        if (!userEmail) {
          return res.status(400).json({ error: 'User email is required for multi-day campaigns' });
        }

        // Create campaign
        const campaignData = {
          name: `HR Outreach Campaign - ${new Date().toLocaleDateString()}`,
          contacts,
          template: template.content,
          subject: template.subject,
          resumeDocLink,
          userEmail,
          delay: parseInt(delayMs) || 10000,
          attachments: resumeFile ? [{
            filename: resumeFile.originalname,
            path: resumeFile.path,
            contentType: 'application/pdf'
          }] : []
        };

        const campaign = await this.campaignService.createCampaign(campaignData);
        
        // Debug logging
        logger.info(`Campaign object after creation: ${JSON.stringify({
          id: campaign?.id,
          name: campaign?.name,
          hasContacts: campaign?.contacts?.length > 0
        }, null, 2)}`);
        
        if (!campaign?.id) {
          logger.error('Campaign ID is undefined after creation!');
          return res.status(500).json({ error: 'Failed to create campaign - invalid ID' });
        }

        // Emit initial log to socket
        const io = req.app.get('io');
        if (io) {
          io.emit('emailLog', {
            type: 'info',
            message: `🚀 Campaign "${campaign.name}" created with ${contacts.length} recipients`
          });
        }

        // Trigger immediate processing of the new campaign
        const schedulerService = req.app.get('schedulerService');
        if (schedulerService) {
          try {
            // Small delay to ensure database write is complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Debug logging for campaign ID before immediate processing
            logger.info(`About to process campaign immediately - ID: ${campaign.id}`);
            
            if (!campaign.id) {
              logger.error('Campaign ID is null/undefined before immediate processing!');
              throw new Error('Campaign ID is undefined');
            }
            
            // Process the new campaign immediately (regardless of business hours)
            await schedulerService.processNewCampaignImmediately(campaign.id);
            logger.info(`✅ New campaign ${campaign.id} processing started immediately`);
          } catch (error) {
            logger.error(`Error processing new campaign immediately: ${error.message}`);
            // Don't fail the response, campaign will be processed later
          }
        }

        // Clean up Excel file
        this.fileService.deleteFile(excelFile.path);

        res.json({
          success: true,
          message: 'Multi-day campaign created successfully',
          campaignId: campaign.id,
          totalEmails: contacts.length,
          dailyBatches: Math.ceil(contacts.length / 300),
          estimatedDays: Math.ceil(contacts.length / 300),
          type: 'campaign'
        });

        return;
      }

      // For immediate sending
      const emails = this.emailService.prepareEmailsFromCampaign({
        template: template.content,
        subject: template.subject,
        contacts,
        resumeDocLink,
        attachments: resumeFile ? [{
          filename: resumeFile.originalname,
          path: resumeFile.path,
          contentType: 'application/pdf'
        }] : []
      });

      // Send response immediately
      res.json({
        message: 'Email sending started',
        totalEmails: emails.length,
        recipients: emails.map(e => ({ 
          company: e.companyName, 
          email: e.to 
        })),
        type: 'immediate'
      });

      // Start sending emails asynchronously
      this.sendEmailsAsync(emails, parseInt(delayMs) || 10000, req.io);

      // Clean up files
      this.fileService.deleteFile(excelFile.path);
    } catch (error) {
      logger.error(`Error in send emails: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // Send emails asynchronously with progress updates
  async sendEmailsAsync(emails, delayMs, io) {
    try {
      const results = await this.emailService.sendEmailBatch(emails, delayMs, (progress) => {
        // Emit progress via socket
        if (io) {
          const emailResult = progress.currentEmail;
          
          if (emailResult.success) {
            io.emit('emailStatus', {
              type: 'success',
              message: `✅ Email sent to ${emailResult.companyName} (${emailResult.recipient})`,
              progress: {
                current: progress.current,
                total: progress.total,
                successCount: progress.successful,
                failureCount: progress.failed
              }
            });
          } else {
            io.emit('emailStatus', {
              type: 'error',
              message: `❌ Failed to send to ${emailResult.companyName} (${emailResult.recipient}): ${emailResult.error}`,
              progress: {
                current: progress.current,
                total: progress.total,
                successCount: progress.successful,
                failureCount: progress.failed
              }
            });
          }
        }
      });

      // Send completion message
      if (io) {
        io.emit('emailStatus', {
          type: 'complete',
          message: `🎉 Email campaign completed! Success: ${results.successful}, Failed: ${results.failed}`,
          progress: {
            current: results.total,
            total: results.total,
            successCount: results.successful,
            failureCount: results.failed
          }
        });
      }

      // Clean up attachments
      this.emailService.cleanupAttachments(emails);
    } catch (error) {
      logger.error(`Error in async email sending: ${error.message}`);
      
      if (io) {
        io.emit('emailStatus', {
          type: 'error',
          message: `❌ Email campaign failed: ${error.message}`
        });
      }
    }
  }

  // POST /api/email/verify - Verify email configuration
  async verifyEmailConfig(req, res) {
    try {
      const verification = await this.emailService.verifyConfiguration();
      res.json(verification);
    } catch (error) {
      logger.error(`Error verifying email config: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/email/estimate - Estimate sending time
  async estimateSendingTime(req, res) {
    try {
      const { emailCount, delayMs } = req.body;
      
      if (!emailCount || emailCount < 1) {
        return res.status(400).json({ error: 'Valid email count is required' });
      }

      const estimate = this.emailService.estimateSendingTime(emailCount, delayMs || 10000);
      res.json(estimate);
    } catch (error) {
      logger.error(`Error estimating sending time: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = EmailController;
