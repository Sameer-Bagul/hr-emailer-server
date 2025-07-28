const cron = require('node-cron');
const CampaignService = require('./campaignService');
const EmailService = require('./emailService');
const NotificationService = require('./notificationService');
const logger = require('../utils/logger');

class SchedulerService {
  constructor(socketHandler = null) {
    this.campaignService = new CampaignService();
    this.emailService = new EmailService();
    this.notificationService = new NotificationService();
    this.socketHandler = socketHandler;
    this.activeJobs = new Map();
    this.isRunning = false;
    this.DAILY_EMAIL_LIMIT = 300; // Gmail safe limit
    
    logger.info('Scheduler service initialized');
  }

  // Start the scheduler
  start() {
    if (this.isRunning) {
      logger.warning('Scheduler is already running');
      return;
    }

    // Schedule campaign processing every hour during business hours (9 AM - 9 PM)
    this.scheduleJob('hourly-campaigns', '0 9-21 * * *', () => {
      this.processDailyCampaigns();
    });

    // Schedule daily summary at 9 AM
    this.scheduleJob('daily-summary', '0 9 * * *', () => {
      this.sendDailySummary();
    });

    // Schedule evening status report at 9 PM
    this.scheduleJob('evening-report', '0 21 * * *', () => {
      this.sendEveningStatusReport();
    });

    // Schedule cleanup job every hour
    this.scheduleJob('cleanup', '0 * * * *', () => {
      this.performCleanup();
    });

    // Schedule status check every 10 minutes during business hours
    this.scheduleJob('status-check', '*/10 9-21 * * *', () => {
      this.checkCampaignStatuses();
    });

    this.isRunning = true;
    logger.info('Scheduler started with all jobs');
  }

  // Stop the scheduler
  stop() {
    if (!this.isRunning) {
      logger.warning('Scheduler is not running');
      return;
    }

    this.activeJobs.forEach((job, name) => {
      job.destroy();
      logger.info(`Stopped scheduled job: ${name}`);
    });

    this.activeJobs.clear();
    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  // Schedule a new job
  scheduleJob(name, cronExpression, task) {
    try {
      if (this.activeJobs.has(name)) {
        logger.warning(`Job ${name} already exists, destroying old job`);
        this.activeJobs.get(name).destroy();
      }

      const job = cron.schedule(cronExpression, async () => {
        try {
          logger.info(`Executing scheduled job: ${name}`);
          await Promise.resolve(task()); // Ensure promise handling
          logger.info(`Completed scheduled job: ${name}`);
        } catch (error) {
          logger.error(`Error in scheduled job ${name}: ${error.message}`);
          
          // Emit error to connected clients
          if (this.socketHandler) {
            this.socketHandler.emitGeneralNotification('serverLog', {
              level: 'error',
              message: `Scheduled job ${name} failed: ${error.message}`,
              timestamp: new Date().toISOString()
            });
          }
          
          // Don't rethrow to prevent scheduler from stopping
        }
      }, {
        scheduled: true,
        timezone: 'America/New_York' // Adjust timezone as needed
      });

      this.activeJobs.set(name, job);
      logger.info(`Scheduled job: ${name} with cron ${cronExpression}`);
      
      return job;
    } catch (error) {
      logger.error(`Error scheduling job ${name}: ${error.message}`);
      throw error;
    }
  }

  // Remove a scheduled job
  removeJob(name) {
    try {
      if (this.activeJobs.has(name)) {
        this.activeJobs.get(name).destroy();
        this.activeJobs.delete(name);
        logger.info(`Removed scheduled job: ${name}`);
        return true;
      }
      
      logger.warning(`Job ${name} not found`);
      return false;
    } catch (error) {
      logger.error(`Error removing job ${name}: ${error.message}`);
      throw error;
    }
  }

  // Get total emails sent today across all campaigns
  async getTodaysEmailCount() {
    try {
      const campaigns = await this.campaignService.getAllCampaigns();
      const today = new Date().toDateString();
      
      let totalSentToday = 0;
      
      campaigns.forEach(campaign => {
        if (campaign.dailyLogs && campaign.dailyLogs.length > 0) {
          const todaysLogs = campaign.dailyLogs.filter(log => 
            new Date(log.sentAt).toDateString() === today && log.status === 'sent'
          );
          totalSentToday += todaysLogs.length;
        }
      });
      
      return totalSentToday;
    } catch (error) {
      logger.error(`Error getting today's email count: ${error.message}`);
      return 0;
    }
  }

  // Check if we can send more emails today (respecting daily limit)
  async canSendMoreEmailsToday(requestedCount = 1) {
    const currentCount = await this.getTodaysEmailCount();
    const remaining = this.DAILY_EMAIL_LIMIT - currentCount;
    
    const statusMessage = `📊 Daily email status: ${currentCount}/${this.DAILY_EMAIL_LIMIT} sent, ${remaining} remaining`;
    logger.info(statusMessage);
    
    // Emit to client
    if (this.socketHandler) {
      this.socketHandler.emitGeneralNotification('serverLog', {
        level: 'info',
        message: statusMessage,
        timestamp: new Date().toISOString()
      });
    }
    
    if (currentCount >= this.DAILY_EMAIL_LIMIT) {
      const limitMessage = `🚫 Daily email limit reached: ${currentCount}/${this.DAILY_EMAIL_LIMIT}. Stopping email processing for today to prevent Gmail blacklisting.`;
      logger.warning(limitMessage);
      
      // Emit to client
      if (this.socketHandler) {
        this.socketHandler.emitGeneralNotification('serverLog', {
          level: 'warning',
          message: limitMessage,
          timestamp: new Date().toISOString()
        });
      }
      
      return false;
    }
    
    return Math.min(requestedCount, remaining);
  }

  // Process daily campaigns
  async processDailyCampaigns(forceProcessing = false) {
    try {
      // Check if we're in business hours (9 AM - 9 PM) unless forced
      const now = new Date();
      const currentHour = now.getHours();
      
      if (!forceProcessing && (currentHour < 9 || currentHour >= 21)) {
        logger.info('Outside business hours (9 AM - 9 PM), skipping campaign processing');
        return;
      }

      // Check daily email limit first
      const canSend = await this.canSendMoreEmailsToday();
      if (!canSend) {
        logger.info('🛑 Daily email limit reached. Skipping campaign processing to prevent Gmail blacklisting.');
        return;
      }

      const timeContext = forceProcessing ? 'with forced processing' : 'during business hours';
      logger.info(`Starting campaign processing ${timeContext}`);
      
      const campaigns = await this.campaignService.getAllCampaigns();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const campaign of campaigns) {
        try {
          // Skip if campaign is completed or paused
          if (campaign.status === 'completed' || campaign.status === 'paused') {
            continue;
          }

          // Check if campaign should start today
          const startDate = new Date(campaign.startDate);
          startDate.setHours(0, 0, 0, 0);

          if (startDate <= today && campaign.status === 'pending') {
            logger.info(`Starting campaign: ${campaign.name} (${campaign.id})`);
            await this.startCampaign(campaign.id);
          }

          // Process active campaigns
          if (campaign.status === 'active') {
            await this.processCampaignBatch(campaign);
          }

        } catch (error) {
          logger.error(`Error processing campaign ${campaign.id}: ${error.message}`);
        }
      }

      logger.info('Completed daily campaign processing');
    } catch (error) {
      logger.error(`Error in daily campaign processing: ${error.message}`);
    }
  }

  // Start a specific campaign
  async startCampaign(campaignId) {
    try {
      const campaign = await this.campaignService.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Update campaign status to active
      await this.campaignService.updateCampaign(campaignId, {
        status: 'active',
        startedAt: new Date()
      });

      const startMessage = `Started campaign: ${campaign.name} (${campaignId})`;
      logger.info(startMessage);

      // Emit socket notification
      if (this.socketHandler) {
        this.socketHandler.emitGeneralNotification('campaign-started', {
          campaignId,
          name: campaign.name
        });
        
        // Also emit as server log
        this.socketHandler.emitGeneralNotification('serverLog', {
          level: 'info',
          message: `ℹ️ INFO: ${startMessage}`,
          timestamp: new Date().toISOString()
        });
      }

      return true;
    } catch (error) {
      logger.error(`Error starting campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  // Process a campaign batch
  async processCampaignBatch(campaign) {
    try {
      // Check global daily limit first
      const canSendGlobal = await this.canSendMoreEmailsToday(50);
      if (!canSendGlobal) {
        const limitMessage = `🚫 Cannot process campaign ${campaign.id}: Global daily limit of ${this.DAILY_EMAIL_LIMIT} emails reached`;
        logger.warning(limitMessage);
        
        // Emit to client
        if (this.socketHandler) {
          this.socketHandler.emitGeneralNotification('serverLog', {
            level: 'warning',
            message: `⚠️ WARNING: ${limitMessage}`,
            timestamp: new Date().toISOString()
          });
        }
        
        return;
      }

      const today = new Date().toDateString();
      const dailyLimit = campaign.dailyLimit || 50;
      
      // Check if we've already sent emails today for this campaign
      const sentToday = (campaign.dailyLogs || []).filter(log => 
        new Date(log.sentAt).toDateString() === today && log.status === 'sent'
      ).length;

      if (sentToday >= dailyLimit) {
        const campaignLimitMessage = `Daily limit reached for campaign ${campaign.id}: ${sentToday}/${dailyLimit}`;
        logger.info(campaignLimitMessage);
        
        // Emit to client
        if (this.socketHandler) {
          this.socketHandler.emitGeneralNotification('serverLog', {
            level: 'info',
            message: `ℹ️ INFO: ${campaignLimitMessage}`,
            timestamp: new Date().toISOString()
          });
        }
        
        return;
      }

      const remainingForCampaign = dailyLimit - sentToday;
      const remainingGlobal = canSendGlobal;
      
      // Use the smaller of campaign limit or global limit
      const batchSize = Math.min(remainingForCampaign, remainingGlobal, 50); // Increased from 10 to 50

      if (batchSize <= 0) {
        const noBatchMessage = `No emails can be sent for campaign ${campaign.id} today (campaign: ${remainingForCampaign}, global: ${remainingGlobal})`;
        logger.info(noBatchMessage);
        
        // Emit to client
        if (this.socketHandler) {
          this.socketHandler.emitGeneralNotification('serverLog', {
            level: 'info',
            message: `ℹ️ INFO: ${noBatchMessage}`,
            timestamp: new Date().toISOString()
          });
        }
        
        return;
      }

      const batchMessage = `Processing batch for campaign ${campaign.id}: ${batchSize} emails (Respecting global limit: ${await this.getTodaysEmailCount()}/${this.DAILY_EMAIL_LIMIT})`;
      logger.info(batchMessage);
      
      // Emit to client
      if (this.socketHandler) {
        this.socketHandler.emitGeneralNotification('serverLog', {
          level: 'info',
          message: `ℹ️ INFO: ${batchMessage}`,
          timestamp: new Date().toISOString()
        });
      }

      // Send batch of emails
      await this.emailService.sendCampaignBatch(campaign.id, batchSize, (progress) => {
        // Emit progress updates
        if (this.socketHandler) {
          // Map progress data to expected format
          const progressData = {
            sent: progress.successful || 0,
            total: progress.total || 0,
            failed: progress.failed || 0,
            current: progress.current || 0
          };
          this.socketHandler.emitCampaignProgress(campaign.id, progressData);
          
          // Emit individual email status if current email result is available
          if (progress.currentEmail) {
            const emailResult = progress.currentEmail;
            if (emailResult.success) {
              this.socketHandler.emitEmailSent(campaign.id, {
                recipient: emailResult.recipient,
                companyName: emailResult.companyName,
                messageId: emailResult.messageId
              });
            } else {
              this.socketHandler.emitEmailError(campaign.id, {
                recipient: emailResult.recipient,
                companyName: emailResult.companyName,
                message: emailResult.error
              });
            }
          }
        }
      });

    } catch (error) {
      const errorMessage = `Error processing campaign batch ${campaign.id}: ${error.message}`;
      logger.error(errorMessage);
      
      // Emit to client
      if (this.socketHandler) {
        this.socketHandler.emitGeneralNotification('serverLog', {
          level: 'error',
          message: `❌ ERROR: ${errorMessage}`,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  // Check campaign statuses and complete if needed
  async checkCampaignStatuses() {
    try {
      const campaigns = await this.campaignService.getAllCampaigns();

      for (const campaign of campaigns) {
        if (campaign.status === 'active') {
          const progress = campaign.getProgress();
          
          // Check if campaign is complete
          if (progress.sent >= progress.total) {
            await this.completeCampaign(campaign.id);
          }
        }
      }
    } catch (error) {
      logger.error(`Error checking campaign statuses: ${error.message}`);
    }
  }

  // Complete a campaign
  async completeCampaign(campaignId) {
    try {
      const campaign = await this.campaignService.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const completedAt = new Date();
      const duration = campaign.startedAt ? 
        Math.ceil((completedAt - new Date(campaign.startedAt)) / (1000 * 60 * 60 * 24)) : 0;

      const updatedCampaign = await this.campaignService.updateCampaign(campaignId, {
        status: 'completed',
        completedAt,
        duration
      });

      logger.info(`Completed campaign: ${campaign.name} (${campaignId}) in ${duration} days`);

      // Emit completion notification
      if (this.socketHandler) {
        this.socketHandler.emitCampaignComplete(campaignId, {
          name: updatedCampaign.name,
          duration,
          completedAt,
          totalEmails: updatedCampaign.totalEmails,
          sentEmails: updatedCampaign.sentEmails,
          failedEmails: updatedCampaign.failedEmails
        });
        
        // Also emit a general completion log
        this.socketHandler.emitGeneralNotification('serverLog', {
          level: 'info',
          message: `🎉 Campaign "${campaign.name}" completed! ${campaign.sentEmails}/${campaign.totalEmails} emails sent in ${duration} days`,
          timestamp: new Date().toISOString()
        });
      }

      // Send email notification to campaign creator
      await this.notificationService.sendCampaignCompletionNotification(updatedCampaign);

      return { success: true, campaign: updatedCampaign };
    } catch (error) {
      logger.error(`Error completing campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  // Perform cleanup tasks
  async performCleanup() {
    try {
      logger.info('Starting scheduled cleanup');

      // Cleanup socket handler if available
      if (this.socketHandler) {
        this.socketHandler.cleanupCompletedCampaigns();
      }

      // Cleanup old email logs (keep last 30 days)
      const campaigns = await this.campaignService.getAllCampaigns();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      for (const campaign of campaigns) {
        if (campaign.emailLogs && campaign.emailLogs.length > 0) {
          const filteredLogs = campaign.emailLogs.filter(log => 
            new Date(log.sentAt) > cutoffDate
          );

          if (filteredLogs.length < campaign.emailLogs.length) {
            await this.campaignService.updateCampaign(campaign.id, {
              emailLogs: filteredLogs
            });
            
            const removed = campaign.emailLogs.length - filteredLogs.length;
            logger.info(`Cleaned up ${removed} old email logs for campaign ${campaign.id}`);
          }
        }
      }

      logger.info('Completed scheduled cleanup');
    } catch (error) {
      logger.error(`Error in scheduled cleanup: ${error.message}`);
    }
  }

  // Send daily summary at 9 AM
  async sendDailySummary() {
    try {
      logger.info('Generating daily summary report');
      
      const campaigns = await this.campaignService.getAllCampaigns();
      const todaysEmailCount = await this.getTodaysEmailCount();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const summary = {
        date: new Date().toLocaleDateString(),
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter(c => c.status === 'active').length,
        completedCampaigns: campaigns.filter(c => c.status === 'completed').length,
        pausedCampaigns: campaigns.filter(c => c.status === 'paused').length,
        totalEmailsSent: campaigns.reduce((sum, c) => sum + (c.sentEmails || 0), 0),
        totalEmailsPending: campaigns.reduce((sum, c) => sum + (c.totalEmails - (c.sentEmails || 0)), 0),
        todaysEmailCount,
        dailyEmailLimit: this.DAILY_EMAIL_LIMIT,
        remainingEmailsToday: Math.max(0, this.DAILY_EMAIL_LIMIT - todaysEmailCount),
        campaignDetails: []
      };

      // Add detailed campaign information
      campaigns.forEach(campaign => {
        if (campaign.status === 'active' || campaign.status === 'pending') {
          const progress = campaign.getProgress();
          summary.campaignDetails.push({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            progress: `${progress.sent}/${progress.total} emails`,
            progressPercentage: Math.round((progress.sent / progress.total) * 100),
            createdAt: campaign.createdAt,
            estimatedCompletion: campaign.getEstimatedCompletion()
          });
        }
      });

      // Send summary email to main user
      await this.sendSummaryEmail('daily', summary);
      
      logger.info('Daily summary report sent successfully');
    } catch (error) {
      logger.error(`Error generating daily summary: ${error.message}`);
    }
  }

  // Manual method to test completion notification (for testing purposes)
  async testCompletionNotification(campaignId) {
    try {
      const campaign = await this.campaignService.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      logger.info(`🧪 Testing completion notification for campaign ${campaignId}`);
      const result = await this.notificationService.sendCampaignCompletionNotification(campaign);
      
      return result;
    } catch (error) {
      logger.error(`Error testing completion notification: ${error.message}`);
      throw error;
    }
  }

  // Manual method to test daily report (for testing purposes)
  async testDailyReport() {
    try {
      logger.info(`🧪 Testing daily status report`);
      const campaigns = await this.campaignService.getAllCampaigns();
      const activeCampaigns = campaigns.filter(c => c.status === 'active');
      
      if (activeCampaigns.length === 0) {
        logger.info('No active campaigns found for testing');
        return { message: 'No active campaigns to report on' };
      }

      const results = await this.notificationService.sendDailyStatusReport(activeCampaigns);
      return { results, campaignCount: activeCampaigns.length };
    } catch (error) {
      logger.error(`Error testing daily report: ${error.message}`);
      throw error;
    }
  }
  async sendEveningStatusReport() {
    try {
      logger.info('📊 Generating evening status report and sending to campaign creators');
      
      const campaigns = await this.campaignService.getAllCampaigns();
      const activeCampaigns = campaigns.filter(c => c.status === 'active');
      
      if (activeCampaigns.length === 0) {
        logger.info('No active campaigns found, skipping evening report');
        return;
      }

      // Send daily reports to all users with active campaigns
      const results = await this.notificationService.sendDailyStatusReport(activeCampaigns);
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      logger.info(`📧 Evening status reports sent: ${successCount} successful, ${failureCount} failed`);
      
      // Log individual results
      results.forEach(result => {
        if (result.success) {
          logger.info(`✅ Evening report sent successfully to ${result.userEmail}`);
        } else {
          logger.error(`❌ Failed to send evening report to ${result.userEmail}: ${result.error}`);
        }
      });
      
    } catch (error) {
      logger.error(`Error generating evening status report: ${error.message}`);
    }
  }

  // Send summary email to main user
  async sendSummaryEmail(type, data) {
    try {
      // Get main user email from first active campaign or env variable
      let mainUserEmail = process.env.MAIN_USER_EMAIL;
      
      if (!mainUserEmail) {
        const campaigns = await this.campaignService.getAllCampaigns();
        const activeCampaign = campaigns.find(c => c.userEmail);
        mainUserEmail = activeCampaign?.userEmail;
      }

      if (!mainUserEmail) {
        logger.warning('No main user email found for summary report');
        return;
      }

      let subject, htmlContent;

      if (type === 'daily') {
        subject = `📊 Daily HR Campaign Summary - ${data.date}`;
        htmlContent = this.generateDailySummaryHTML(data);
      } else {
        subject = `🌙 Evening Status Report - ${data.date}`;
        htmlContent = this.generateEveningReportHTML(data);
      }

      // Use email service to send summary
      const emailData = {
        to: mainUserEmail,
        subject,
        html: htmlContent,
        from: process.env.SMTP_FROM_EMAIL || 'hr-emailer@system.com'
      };

      await this.emailService.sendEmail(emailData);
      logger.info(`${type} summary sent to ${mainUserEmail}`);
      
    } catch (error) {
      logger.error(`Error sending ${type} summary email: ${error.message}`);
    }
  }

  // Generate HTML for daily summary
  generateDailySummaryHTML(data) {
    const limitWarning = data.remainingEmailsToday <= 50 ? 
      `<div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <p style="margin: 0; color: #856404;">⚠️ <strong>Warning:</strong> Only ${data.remainingEmailsToday} emails remaining today!</p>
      </div>` : '';

    const limitReached = data.remainingEmailsToday === 0 ? 
      `<div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <p style="margin: 0; color: #721c24;">🚫 <strong>Daily limit reached!</strong> No more emails will be sent today to prevent Gmail blacklisting.</p>
      </div>` : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db;">📊 Daily HR Campaign Summary</h2>
        <p><strong>Date:</strong> ${data.date}</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">📈 Overall Statistics</h3>
          <ul style="list-style: none; padding: 0;">
            <li>📧 <strong>Total Emails Sent:</strong> ${data.totalEmailsSent}</li>
            <li>⏳ <strong>Emails Pending:</strong> ${data.totalEmailsPending}</li>
            <li>📋 <strong>Total Campaigns:</strong> ${data.totalCampaigns}</li>
            <li>🟢 <strong>Active Campaigns:</strong> ${data.activeCampaigns}</li>
            <li>✅ <strong>Completed Campaigns:</strong> ${data.completedCampaigns}</li>
            <li>⏸️ <strong>Paused Campaigns:</strong> ${data.pausedCampaigns}</li>
          </ul>
        </div>

        <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1976d2; margin-top: 0;">📬 Daily Email Limit Status</h3>
          <p style="margin: 5px 0;"><strong>Today's Emails Sent:</strong> ${data.todaysEmailCount}/${data.dailyEmailLimit}</p>
          <p style="margin: 5px 0;"><strong>Remaining Today:</strong> ${data.remainingEmailsToday}</p>
          <div style="background: #e9ecef; border-radius: 10px; height: 12px; margin: 10px 0;">
            <div style="background: ${data.remainingEmailsToday > 50 ? '#28a745' : data.remainingEmailsToday > 0 ? '#ffc107' : '#dc3545'}; height: 12px; border-radius: 10px; width: ${Math.round((data.todaysEmailCount / data.dailyEmailLimit) * 100)}%;"></div>
          </div>
          <p style="margin: 5px 0; font-size: 0.9em; color: #6c757d;">Daily limit prevents Gmail blacklisting</p>
        </div>

        ${limitWarning}
        ${limitReached}

        ${data.campaignDetails.length > 0 ? `
        <div style="background: #fff; border: 1px solid #dee2e6; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2c3e50; padding: 15px; margin: 0; border-bottom: 1px solid #dee2e6;">🎯 Active Campaign Details</h3>
          ${data.campaignDetails.map(campaign => `
            <div style="padding: 15px; border-bottom: 1px solid #f1f3f4;">
              <h4 style="margin: 0 0 10px 0; color: #495057;">${campaign.name}</h4>
              <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${campaign.status === 'active' ? '#28a745' : '#ffc107'};">${campaign.status.toUpperCase()}</span></p>
              <p style="margin: 5px 0;"><strong>Progress:</strong> ${campaign.progress} (${campaign.progressPercentage}%)</p>
              <div style="background: #e9ecef; border-radius: 10px; height: 10px; margin: 10px 0;">
                <div style="background: #28a745; height: 10px; border-radius: 10px; width: ${campaign.progressPercentage}%;"></div>
              </div>
              <p style="margin: 5px 0; font-size: 0.9em; color: #6c757d;"><strong>Est. Completion:</strong> ${campaign.estimatedCompletion}</p>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #0c5aa6;"><strong>📅 Next Processing:</strong> Campaigns will be processed hourly between 9:00 AM - 9:00 PM (respecting daily limits)</p>
        </div>
      </div>
    `;
  }

  // Generate HTML for evening report
  generateEveningReportHTML(data) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #8e44ad;">🌙 Evening Status Report</h2>
        <p><strong>Date:</strong> ${data.date}</p>
        <p><strong>Business Hours:</strong> ${data.businessHours}</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">📊 Today's Activity</h3>
          <p><strong>📧 Total Emails Sent Today:</strong> ${data.emailsSentToday}</p>
        </div>

        ${data.campaignActivity.length > 0 ? `
        <div style="background: #fff; border: 1px solid #dee2e6; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2c3e50; padding: 15px; margin: 0; border-bottom: 1px solid #dee2e6;">🎯 Campaign Activity Today</h3>
          ${data.campaignActivity.map(activity => `
            <div style="padding: 15px; border-bottom: 1px solid #f1f3f4;">
              <h4 style="margin: 0 0 10px 0; color: #495057;">${activity.campaignName}</h4>
              <p style="margin: 5px 0;">📧 <strong>Emails Sent:</strong> ${activity.emailsSent}</p>
              <p style="margin: 5px 0;">✅ <strong>Successful:</strong> ${activity.successfulSends}</p>
              <p style="margin: 5px 0;">❌ <strong>Failed:</strong> ${activity.failedSends}</p>
            </div>
          `).join('')}
        </div>
        ` : '<p style="color: #6c757d; font-style: italic;">No campaign activity today.</p>'}

        <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; color: #0c5aa6;"><strong>📅 ${data.nextProcessing}</strong></p>
        </div>
      </div>
    `;
  }

  // Get scheduler statistics
  async getStatistics() {
    const todaysEmailCount = await this.getTodaysEmailCount();
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.activeJobs.keys()),
      jobCount: this.activeJobs.size,
      lastRun: new Date(),
      dailyEmailLimit: this.DAILY_EMAIL_LIMIT,
      todaysEmailCount,
      remainingEmailsToday: Math.max(0, this.DAILY_EMAIL_LIMIT - todaysEmailCount),
      limitReached: todaysEmailCount >= this.DAILY_EMAIL_LIMIT
    };
  }

  // Manual trigger for testing
  async triggerDailyCampaigns(forceProcessing = false) {
    logger.info('Manually triggering daily campaign processing');
    await this.processDailyCampaigns(forceProcessing);
  }

  // Process new campaign immediately (called when campaign is created) - Send ALL emails with user delay
  async processNewCampaignImmediately(campaignId) {
    try {
      if (!campaignId) {
        throw new Error('Campaign ID is required');
      }
      
      const immediateMessage = `🚀 Processing new campaign immediately: ${campaignId}`;
      logger.info(immediateMessage);
      
      // Emit to client
      if (this.socketHandler) {
        this.socketHandler.emitGeneralNotification('serverLog', {
          level: 'info',
          message: `ℹ️ INFO: ${immediateMessage}`,
          timestamp: new Date().toISOString()
        });
      }
      
      const campaign = await this.campaignService.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Start the campaign immediately
      await this.startCampaign(campaignId);
      
      // Process ALL emails in one session (up to daily limit of 300)
      const totalEmails = Math.min(campaign.totalEmails, this.DAILY_EMAIL_LIMIT);
      const emailsToSend = totalEmails - (campaign.sentEmails || 0);
      
      if (emailsToSend <= 0) {
        logger.info(`Campaign ${campaignId} has no emails to send`);
        return true;
      }
      
      const processingMessage = `📧 Processing ALL emails for campaign ${campaignId}: ${emailsToSend} emails with ${campaign.delay || 10000}ms delay`;
      logger.info(processingMessage);
      
      // Emit to client
      if (this.socketHandler) {
        this.socketHandler.emitGeneralNotification('serverLog', {
          level: 'info',
          message: `ℹ️ INFO: ${processingMessage}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Send all emails in one continuous batch with user-specified delay
      await this.emailService.sendCampaignBatch(campaignId, emailsToSend, (progress) => {
        // Emit progress updates
        if (this.socketHandler) {
          // Map progress data to expected format
          const progressData = {
            sent: progress.successful || 0,
            total: progress.total || 0,
            failed: progress.failed || 0,
            current: progress.current || 0
          };
          this.socketHandler.emitCampaignProgress(campaignId, progressData);
          
          // Emit individual email status if current email result is available
          if (progress.currentEmail) {
            const emailResult = progress.currentEmail;
            if (emailResult.success) {
              this.socketHandler.emitEmailSent(campaignId, {
                recipient: emailResult.recipient,
                companyName: emailResult.companyName,
                messageId: emailResult.messageId
              });
            } else {
              this.socketHandler.emitEmailError(campaignId, {
                recipient: emailResult.recipient,
                companyName: emailResult.companyName,
                message: emailResult.error
              });
            }
          }
        }
      });

      // Get final campaign status
      const finalCampaign = await this.campaignService.getCampaignById(campaignId);
      logger.info(`✅ New campaign ${campaignId} processing completed - ${finalCampaign.sentEmails}/${finalCampaign.totalEmails} emails sent`);
      
      return true;
    } catch (error) {
      logger.error(`Error processing new campaign immediately: ${error.message}`);
      throw error;
    }
  }

  async triggerCleanup() {
    logger.info('Manually triggering cleanup');
    await this.performCleanup();
  }

  // Manually trigger daily summary
  async triggerDailySummary() {
    logger.info('Manually triggering daily summary');
    await this.sendDailySummary();
  }

  // Manually trigger evening report
  async triggerEveningReport() {
    logger.info('Manually triggering evening report');
    await this.sendEveningStatusReport();
  }

  // Manually continue processing a specific campaign - Send ALL remaining emails
  async continueCampaignProcessing(campaignId, maxBatches = null) {
    try {
      logger.info(`📧 Manually continuing campaign processing: ${campaignId}`);
      
      const campaign = await this.campaignService.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      if (campaign.status !== 'active') {
        throw new Error(`Campaign ${campaignId} is not active (status: ${campaign.status})`);
      }

      // Calculate remaining emails to send
      const remainingEmails = campaign.totalEmails - (campaign.sentEmails || 0);
      const emailsToSend = Math.min(remainingEmails, this.DAILY_EMAIL_LIMIT - await this.getTodaysEmailCount());
      
      if (emailsToSend <= 0) {
        logger.info(`No emails remaining to send for campaign ${campaignId}`);
        return {
          batchesProcessed: 0,
          emailsSent: campaign.sentEmails,
          totalEmails: campaign.totalEmails,
          completed: campaign.sentEmails >= campaign.totalEmails,
          message: 'No emails remaining or daily limit reached'
        };
      }
      
      const processingMessage = `📧 Continuing processing for campaign ${campaignId}: ${emailsToSend} remaining emails with ${campaign.delay || 10000}ms delay`;
      logger.info(processingMessage);
      
      // Emit to client
      if (this.socketHandler) {
        this.socketHandler.emitGeneralNotification('serverLog', {
          level: 'info',
          message: `ℹ️ INFO: ${processingMessage}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Send all remaining emails in one continuous batch
      await this.emailService.sendCampaignBatch(campaignId, emailsToSend, (progress) => {
        // Emit progress updates
        if (this.socketHandler) {
          // Map progress data to expected format
          const progressData = {
            sent: progress.successful || 0,
            total: progress.total || 0,
            failed: progress.failed || 0,
            current: progress.current || 0
          };
          this.socketHandler.emitCampaignProgress(campaignId, progressData);
          
          // Emit individual email status if current email result is available
          if (progress.currentEmail) {
            const emailResult = progress.currentEmail;
            if (emailResult.success) {
              this.socketHandler.emitEmailSent(campaignId, {
                recipient: emailResult.recipient,
                companyName: emailResult.companyName,
                messageId: emailResult.messageId
              });
            } else {
              this.socketHandler.emitEmailError(campaignId, {
                recipient: emailResult.recipient,
                companyName: emailResult.companyName,
                message: emailResult.error
              });
            }
          }
        }
      });

      const finalCampaign = await this.campaignService.getCampaignById(campaignId);
      logger.info(`✅ Manual processing completed for campaign ${campaignId}: ${finalCampaign.sentEmails}/${finalCampaign.totalEmails} emails sent`);
      
      return {
        batchesProcessed: 1,
        emailsSent: finalCampaign.sentEmails,
        totalEmails: finalCampaign.totalEmails,
        completed: finalCampaign.sentEmails >= finalCampaign.totalEmails
      };
    } catch (error) {
      logger.error(`Error in manual campaign processing: ${error.message}`);
      throw error;
    }
  }
}

module.exports = SchedulerService;
