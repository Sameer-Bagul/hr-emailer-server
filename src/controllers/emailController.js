const EmailService = require('../services/emailService');
const CampaignService = require('../services/campaignService');
const FileService = require('../services/fileService');
const Template = require('../models/Template');
const logger = require('../utils/logger');

/**
 * Email Controller
 *
 * Handles HTTP requests related to email operations including sending emails,
 * campaign management, email verification, and logging. This controller
 * serves as the main interface between the API endpoints and the business
 * logic services.
 *
 * Key Responsibilities:
 * - Process email sending requests (immediate and campaign-based)
 * - Handle file uploads and validation
 * - Manage campaign creation and execution
 * - Provide email verification and estimation services
 * - Retrieve and filter email logs
 * - Implement rate limiting and security measures
 *
 * @class EmailController
 */
class EmailController {
  /**
   * Initialize the Email Controller with required services
   *
   * @constructor
   */
  constructor() {
    /**
     * Email service for sending emails and managing email operations
     * @type {EmailService}
     */
    this.emailService = new EmailService();

    /**
     * Campaign service for managing multi-day email campaigns
     * @type {CampaignService}
     */
    this.campaignService = new CampaignService();

    /**
     * File service for handling file uploads and processing
     * @type {FileService}
     */
    this.fileService = new FileService();
  }
  /**
   * Send emails endpoint - handles both immediate sending and campaign creation
   *
   * This is the main endpoint for email operations. It supports:
   * - Immediate email sending (up to 300 emails at once)
   * - Multi-day campaign creation (spreads emails over days)
   * - File upload processing (Excel/CSV with recipient data)
   * - Resume attachment handling
   * - Template selection and rendering
   * - Real-time progress updates via Socket.IO
   *
   * @param {Object} req - Express request object
   * @param {Object} req.body - Request body parameters
   * @param {string} req.body.delayMs - Delay between emails in milliseconds
   * @param {string} req.body.resumeDocLink - Link to resume document
   * @param {string} req.body.userEmail - Sender email address
   * @param {string} req.body.campaignType - 'immediate' or 'multi-day'
   * @param {string} req.body.templateId - Template ID to use
   * @param {Array} req.files - Uploaded files (Excel and resume)
   * @param {Object} res - Express response object
   *
   * @returns {Promise<void>} Sends JSON response with operation result
   */
   async sendEmails(req, res) {
     // Response safety mechanism to prevent double responses
     // This ensures we don't try to send response headers twice
     let responseSent = false;

     /**
      * Safely send JSON response, preventing double responses
      * @param {Object} data - Response data to send
      */
     const safeJson = (data) => {
       if (!responseSent) {
         responseSent = true;
         res.json(data);
       }
     };

     /**
      * Safely send error response, preventing double responses
      * @param {Error|string} error - Error to send
      * @param {number} status - HTTP status code
      */
     const safeError = (error, status = 500) => {
       if (!responseSent) {
         responseSent = true;
         // Sanitize error messages to prevent information leakage
         const sanitizedError = this.sanitizeErrorForResponse(error);
         res.status(status).json({ error: sanitizedError });
       }
     };

     try {
       logger.email('Email sending endpoint called');

       // Debug logging for development
       console.log('Request body:', req.body);
       console.log('Request files:', req.files);

       logger.info('[DEBUG] Starting sendEmails processing');

      const { delayMs, resumeDocLink, userEmail, campaignType, templateId, manualRecipients } = req.body;
      const files = req.files;
      const excelFile = files?.file?.[0];
      const resumeFile = files?.resume?.[0];

      console.log('Parsed data:', { delayMs, resumeDocLink, userEmail, campaignType, excelFile: excelFile?.filename, resumeFile: resumeFile?.filename, manualRecipients });

      // Validate that we have either a file or manual recipients
      let recipients = [];
      let hasValidRecipients = false;

      if (excelFile) {
        // Handle CSV/Excel file upload
        console.log('File path:', excelFile.path);
        console.log('File size:', excelFile.size);
        console.log('About to parse file:', excelFile.path);

        // Determine file type and parse accordingly
        const fileExtension = excelFile.originalname.split('.').pop().toLowerCase();
        let parseResult;

        if (fileExtension === 'csv') {
          console.log('Parsing as CSV file');
          parseResult = await this.fileService.parseCsvFile(excelFile.path);
        } else {
          console.log('Parsing as Excel file');
          parseResult = await this.fileService.parseExcelFile(excelFile.path);
        }

        console.log('Parse result:', parseResult);
        if (!parseResult.success) {
          return safeError(parseResult.error, 400);
        }

        recipients = parseResult.recipients;
        if (recipients.length === 0) {
          return safeError('No valid recipients found in Excel file', 400);
        }
        hasValidRecipients = true;
        logger.info(`[DEBUG] File parsed successfully, recipients: ${recipients.length}`);
      } else if (manualRecipients) {
        // Handle manual recipients
        try {
          const parsedRecipients = JSON.parse(manualRecipients);
          if (Array.isArray(parsedRecipients) && parsedRecipients.length > 0) {
            recipients = parsedRecipients.map(r => ({
              email: r.email,
              company_name: r.companyName
            }));
            hasValidRecipients = true;
          }
        } catch (error) {
          return safeError('Invalid manual recipients format', 400);
        }
      }

      if (!hasValidRecipients) {
        return safeError('No recipients provided. Please upload a CSV file or add manual recipients.', 400);
      }


      // Load template based on templateId or use default
      logger.info(`[DEBUG] Loading template, templateId: ${templateId}`);
      let template;
      if (templateId) {
        template = Template.getTemplateById(templateId);
        if (!template) {
          return safeError(`Template ${templateId} not found`, 400);
        }
      } else {
        template = Template.loadDefaultTemplate();
      }

      if (!template) {
        return safeError('Failed to load email template', 500);
      }
      logger.info(`[DEBUG] Template loaded successfully: ${template.name}`);

      // Convert recipients to campaign format
      const contacts = recipients.map(r => ({
        email: r.email,
        company_name: r.company_name || r.companyName
      }));

      // Check if this should be a multi-day campaign
      if (campaignType === 'multi-day') {
        logger.campaign('Creating multi-day campaign...');
        logger.info(`[DEBUG] Campaign type: ${campaignType}, contacts: ${contacts.length}`);

        if (!userEmail) {
          return safeError('User email is required for multi-day campaigns', 400);
        }

        // Create campaign
        logger.info('[DEBUG] Preparing campaign data');
        const campaignData = {
          name: `${template.category === 'freelancing' ? 'Freelancing' : 'Job Application'} Campaign - ${new Date().toLocaleDateString()}`,
          contacts,
          template: template.content,
          templateId: template.id,
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

        logger.info('[DEBUG] Calling campaignService.createCampaign');
        const campaign = await this.campaignService.createCampaign(campaignData);
        logger.info('[DEBUG] Campaign created successfully');

        // Debug logging
        logger.info(`Campaign object after creation: ${JSON.stringify({
          id: campaign?.id,
          name: campaign?.name,
          hasContacts: campaign?.contacts?.length > 0
        }, null, 2)}`);

        if (!campaign?.id) {
          logger.error('Campaign ID is undefined after creation!');
          return safeError('Failed to create campaign - invalid ID', 500);
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

        // Clean up Excel file if it exists
        if (excelFile) {
          this.fileService.deleteFile(excelFile.path);
        }

        safeJson({
          success: true,
          message: 'Multi-day campaign created successfully',
          campaignId: campaign.id,
          totalEmails: contacts.length,
          dailyBatches: Math.ceil(contacts.length / 300),
          estimatedDays: Math.ceil(contacts.length / 300),
          type: 'campaign',
          templateUsed: template.name
        });

        return;
      }

      // For immediate sending
      const emails = this.emailService.prepareEmailsFromCampaign({
        template: template.content,
        subject: template.subject,
        templateId: template.id,
        contacts,
        resumeDocLink,
        attachments: resumeFile ? [{
          filename: resumeFile.originalname,
          path: resumeFile.path,
          contentType: 'application/pdf'
        }] : []
      });

      // Send response immediately
      safeJson({
        message: 'Email sending started',
        totalEmails: emails.length,
        recipients: emails.map(e => ({
          company: e.companyName,
          email: e.to
        })),
        type: 'immediate',
        templateUsed: template.name
      });

      // Start sending emails asynchronously
      this.sendEmailsAsync(emails, parseInt(delayMs) || 10000);

      // Clean up files
      if (excelFile) {
        this.fileService.deleteFile(excelFile.path);
      }
    } catch (error) {
      logger.error(`Error in send emails: ${error.message}`);
      safeError(error.message || error, 500);
    }
  }

  // Send emails asynchronously with progress updates and memory optimization
  async sendEmailsAsync(emails, delayMs) {
    try {
      // Use memory-efficient processing for large lists
      const results = await this.emailService.processLargeEmailList(emails, {
        delayMs: delayMs,
        batchSize: this.emailService.batchConfig.defaultBatchSize
      }, (progress) => {
        // Progress callback - no socket emissions needed
      });

      // Generate comprehensive report
      const report = this.emailService.generateBatchReport(results);

      // Clean up attachments
      this.emailService.cleanupAttachments(emails);

      logger.info(`Email campaign completed with report: ${JSON.stringify(report.summary)}`);
    } catch (error) {
      logger.error(`Error in async email sending: ${error.message}`);
    }
  }

  // POST /api/email/verify - Verify email configuration
  async verifyEmailConfig(req, res) {
    try {
      const verification = await this.emailService.verifyConfiguration();
      res.json(verification);
    } catch (error) {
      logger.error(`Error verifying email config: ${error.message}`);
      res.status(500).json({ error: this.sanitizeErrorForResponse(error) });
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
      res.status(500).json({ error: this.sanitizeErrorForResponse(error) });
    }
  }

  // GET /api/email/rate-limit - Get current rate limit status
  async getRateLimitStatus(req, res) {
    try {
      const rateLimitStatus = this.emailService.getRateLimitStatus();
      res.json(rateLimitStatus);
    } catch (error) {
      logger.error(`Error getting rate limit status: ${error.message}`);
      res.status(500).json({ error: this.sanitizeErrorForResponse(error) });
    }
  }

  // GET /api/email/batch-config - Get batch processing configuration
  async getBatchConfig(req, res) {
    try {
      const batchConfig = this.emailService.getBatchConfig();
      const smtpCapabilities = await this.emailService.getSMTPCapabilities();
      const memoryStats = this.emailService.getMemoryStats();

      res.json({
        batchConfig,
        smtpCapabilities,
        memoryStats,
        recommendations: {
          optimalBatchSize: await this.emailService.optimizeBatchSize(),
          memoryEfficient: batchConfig.enableMemoryOptimization
        }
      });
    } catch (error) {
      logger.error(`Error getting batch config: ${error.message}`);
      res.status(500).json({ error: this.sanitizeErrorForResponse(error) });
    }
  }

  // GET /api/emails/logs - Get email logs
  async getLogs(req, res) {
    try {
      logger.email('Email logs endpoint called');

      // Get all campaigns with their logs
      const campaigns = await this.campaignService.getAllCampaigns();
      const emailLogs = [];

      campaigns.forEach(campaign => {
        // Extract logs from daily logs
        if (campaign.dailyLogs && campaign.dailyLogs.length > 0) {
          campaign.dailyLogs.forEach(dailyLog => {
            if (dailyLog.recipients && dailyLog.recipients.length > 0) {
              dailyLog.recipients.forEach(recipient => {
                emailLogs.push({
                  id: `${campaign.id}_${recipient.email}_${dailyLog.date}`,
                  campaignId: campaign.id,
                  recipient: recipient.email,
                  company: recipient.companyName || recipient.company_name || 'Unknown',
                  status: recipient.success ? 'sent' : 'failed',
                  sentAt: recipient.timestamp || dailyLog.date,
                  error: recipient.error || null
                });
              });
            }
          });
        }

        // Also check for any recent email results from campaign progress
        if (campaign.contacts && campaign.sentEmails > 0) {
          // For campaigns that have been processed, create mock logs based on progress
          const processed = campaign.contacts.slice(0, campaign.sentEmails);
          processed.forEach((contact, index) => {
            const logId = `${campaign.id}_${contact.email}_${Date.now()}_${index}`;
            if (!emailLogs.find(log => log.recipient === contact.email && log.campaignId === campaign.id)) {
              emailLogs.push({
                id: logId,
                campaignId: campaign.id,
                recipient: contact.email,
                company: contact.company_name || 'Unknown',
                status: 'sent', // Assume sent if it's in sentEmails count
                sentAt: campaign.lastProcessedAt || campaign.createdAt,
                error: null
              });
            }
          });
        }

        // Add failed emails
        if (campaign.contacts && campaign.failedEmails > 0) {
          const failedCount = campaign.failedEmails;
          const totalProcessed = campaign.sentEmails + campaign.failedEmails;
          const failed = campaign.contacts.slice(campaign.sentEmails, totalProcessed);
          
          failed.forEach((contact, index) => {
            const logId = `${campaign.id}_${contact.email}_failed_${Date.now()}_${index}`;
            if (!emailLogs.find(log => log.recipient === contact.email && log.campaignId === campaign.id)) {
              emailLogs.push({
                id: logId,
                campaignId: campaign.id,
                recipient: contact.email,
                company: contact.company_name || 'Unknown',
                status: 'failed',
                sentAt: campaign.lastProcessedAt || campaign.createdAt,
                error: 'Email sending failed'
              });
            }
          });
        }

        // Add pending emails
        if (campaign.contacts && campaign.status !== 'completed') {
          const totalProcessed = campaign.sentEmails + campaign.failedEmails;
          const pending = campaign.contacts.slice(totalProcessed);
          
          pending.forEach((contact, index) => {
            const logId = `${campaign.id}_${contact.email}_pending_${Date.now()}_${index}`;
            emailLogs.push({
              id: logId,
              campaignId: campaign.id,
              recipient: contact.email,
              company: contact.company_name || 'Unknown',
              status: 'pending',
              sentAt: null,
              error: null
            });
          });
        }
      });

      // Sort by most recent first
      emailLogs.sort((a, b) => {
        const aTime = a.sentAt ? new Date(a.sentAt).getTime() : 0;
        const bTime = b.sentAt ? new Date(b.sentAt).getTime() : 0;
        return bTime - aTime;
      });

      // Apply pagination (optional query params)
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 100;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      const paginatedLogs = emailLogs.slice(startIndex, endIndex);

      logger.email(`Returning ${paginatedLogs.length} email logs (total: ${emailLogs.length})`);

      res.json({
        logs: paginatedLogs,
        pagination: {
          page,
          limit,
          total: emailLogs.length,
          pages: Math.ceil(emailLogs.length / limit)
        }
      });

    } catch (error) {
      logger.error(`Error getting email logs: ${error.message}`);
      res.status(500).json({ error: this.sanitizeErrorForResponse(error) });
    }
  }

  // Sanitize error messages for API responses
  sanitizeErrorForResponse(error) {
    if (!error) return 'An unexpected error occurred';

    const errorMessage = error.message || error.toString();

    // Remove sensitive information
    let sanitized = errorMessage
      .replace(/password[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{8,})/gi, 'password=***REDACTED***')
      .replace(/token[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{20,})/gi, 'token=***REDACTED***')
      .replace(/key[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{16,})/gi, 'key=***REDACTED***')
      .replace(/secret[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{16,})/gi, 'secret=***REDACTED***')
      .replace(/auth[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s,;]{16,})/gi, 'auth=***REDACTED***')
      .replace(/email[^a-zA-Z0-9]*[:=][^a-zA-Z0-9]*([^\s@]+@[^\s@]+\.[^\s@]+)/gi, 'email=***REDACTED***');

    // Categorize common errors
    if (sanitized.includes('authentication') || sanitized.includes('credentials')) {
      return 'Authentication failed. Please check your email configuration.';
    }

    if (sanitized.includes('rate limit') || sanitized.includes('too many')) {
      return 'Rate limit exceeded. Please wait before sending more emails.';
    }

    if (sanitized.includes('network') || sanitized.includes('connection')) {
      return 'Network error. Please check your internet connection and try again.';
    }

    if (sanitized.includes('validation') || sanitized.includes('invalid')) {
      return sanitized; // Validation errors are generally safe to show
    }

    // For unknown errors, provide a generic message
    if (sanitized.length > 100) {
      return 'An error occurred while processing your request.';
    }

    return sanitized;
  }
}

module.exports = EmailController;
