const EmailService = require('./emailService');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.emailService = new EmailService();
  }

  // Send campaign completion notification to creator
  async sendCampaignCompletionNotification(campaign) {
    try {
      if (!campaign.userEmail) {
        logger.warn(`No user email found for campaign ${campaign.id}, skipping completion notification`);
        return;
      }

      const progress = {
        sent: campaign.sentEmails || 0,
        total: campaign.totalEmails || 0,
        failed: campaign.failedEmails || 0
      };
      const duration = campaign.startedAt ? 
        Math.ceil((new Date() - new Date(campaign.startedAt)) / (1000 * 60 * 60 * 24)) : 0;

      const emailData = {
        to: campaign.userEmail,
        subject: `🎉 Campaign Completed: ${campaign.name}`,
        html: this.generateCompletionEmailTemplate(campaign, progress, duration),
        from: process.env.SMTP_FROM_EMAIL || 'noreply@hr-emailer.com'
      };

      const result = await this.emailService.sendEmail(emailData);
      
      if (result.success) {
        logger.info(`✅ Campaign completion notification sent to ${campaign.userEmail} for campaign ${campaign.id}`);
      } else {
        logger.error(`❌ Failed to send completion notification: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error(`Error sending campaign completion notification: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Send daily status report at 9 PM
  async sendDailyStatusReport(campaigns) {
    try {
      // Group campaigns by user email
      const campaignsByUser = new Map();
      
      for (const campaign of campaigns) {
        if (campaign.status === 'active' && campaign.userEmail) {
          if (!campaignsByUser.has(campaign.userEmail)) {
            campaignsByUser.set(campaign.userEmail, []);
          }
          campaignsByUser.get(campaign.userEmail).push(campaign);
        }
      }

      const results = [];
      
      for (const [userEmail, userCampaigns] of campaignsByUser) {
        try {
          const emailData = {
            to: userEmail,
            subject: `📊 Daily HR Campaign Report - ${new Date().toLocaleDateString()}`,
            html: this.generateDailyReportTemplate(userCampaigns),
            from: process.env.SMTP_FROM_EMAIL || 'noreply@hr-emailer.com'
          };

          const result = await this.emailService.sendEmail(emailData);
          
          if (result.success) {
            logger.info(`✅ Daily report sent to ${userEmail} for ${userCampaigns.length} campaigns`);
          } else {
            logger.error(`❌ Failed to send daily report to ${userEmail}: ${result.error}`);
          }
          
          results.push({ userEmail, success: result.success, error: result.error });
        } catch (error) {
          logger.error(`Error sending daily report to ${userEmail}: ${error.message}`);
          results.push({ userEmail, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      logger.error(`Error sending daily status reports: ${error.message}`);
      return [];
    }
  }

  // Generate completion email template
  generateCompletionEmailTemplate(campaign, progress, duration) {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat { text-align: center; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
        .stat-label { font-size: 12px; color: #666; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Campaign Completed!</h1>
            <h2>${campaign.name}</h2>
        </div>
        
        <div class="content">
            <p>Great news! Your HR outreach campaign has been successfully completed.</p>
            
            <div class="stats">
                <div class="stat">
                    <div class="stat-number success">${progress.sent || 0}</div>
                    <div class="stat-label">Emails Sent</div>
                </div>
                <div class="stat">
                    <div class="stat-number error">${progress.failed || 0}</div>
                    <div class="stat-label">Failed</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${duration}</div>
                    <div class="stat-label">Days</div>
                </div>
            </div>
            
            <h3>Campaign Summary:</h3>
            <ul>
                <li><strong>Campaign Name:</strong> ${campaign.name}</li>
                <li><strong>Total Emails:</strong> ${progress.total || 0}</li>
                <li><strong>Successfully Sent:</strong> <span class="success">${progress.sent || 0}</span></li>
                <li><strong>Failed:</strong> <span class="error">${progress.failed || 0}</span></li>
                <li><strong>Success Rate:</strong> ${progress.total ? Math.round((progress.sent / progress.total) * 100) : 0}%</li>
                <li><strong>Duration:</strong> ${duration} day(s)</li>
                <li><strong>Completed:</strong> ${new Date().toLocaleString()}</li>
            </ul>
            
            <p>Thank you for using our HR Outreach Emailer! We hope your campaign was successful in reaching potential candidates.</p>
        </div>
        
        <div class="footer">
            <p>This is an automated notification from your HR Outreach Emailer system.</p>
        </div>
    </div>
</body>
</html>`;
  }

  // Generate daily report template
  generateDailyReportTemplate(campaigns) {
    const totalSent = campaigns.reduce((sum, c) => sum + (c.getProgress ? c.getProgress().sent : 0), 0);
    const totalFailed = campaigns.reduce((sum, c) => sum + (c.getProgress ? c.getProgress().failed : 0), 0);
    const totalEmails = campaigns.reduce((sum, c) => sum + (c.getProgress ? c.getProgress().total : 0), 0);

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .campaign { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #4facfe; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat { text-align: center; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-number { font-size: 24px; font-weight: bold; color: #4facfe; }
        .stat-label { font-size: 12px; color: #666; }
        .progress-bar { background: #e0e0e0; border-radius: 10px; height: 8px; margin: 5px 0; }
        .progress-fill { background: #4facfe; height: 100%; border-radius: 10px; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Daily Campaign Report</h1>
            <h3>${new Date().toLocaleDateString()}</h3>
        </div>
        
        <div class="content">
            <p>Here's your daily update on all active HR outreach campaigns:</p>
            
            <div class="stats">
                <div class="stat">
                    <div class="stat-number">${campaigns.length}</div>
                    <div class="stat-label">Active Campaigns</div>
                </div>
                <div class="stat">
                    <div class="stat-number success">${totalSent}</div>
                    <div class="stat-label">Emails Sent Today</div>
                </div>
                <div class="stat">
                    <div class="stat-number error">${totalFailed}</div>
                    <div class="stat-label">Failed Today</div>
                </div>
            </div>
            
            <h3>Campaign Details:</h3>
            ${campaigns.map(campaign => {
              const progress = campaign.getProgress ? campaign.getProgress() : { sent: 0, total: 1, failed: 0 };
              const percentage = Math.round((progress.sent / progress.total) * 100);
              
              return `
                <div class="campaign">
                    <h4>${campaign.name}</h4>
                    <p><strong>Progress:</strong> ${progress.sent}/${progress.total} emails sent (${percentage}%)</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <p>
                        <span class="success">✅ Sent: ${progress.sent}</span> | 
                        <span class="error">❌ Failed: ${progress.failed}</span>
                    </p>
                    <p><small>Started: ${campaign.startedAt ? new Date(campaign.startedAt).toLocaleDateString() : 'N/A'}</small></p>
                </div>
              `;
            }).join('')}
            
            <p>Keep up the great work! Your campaigns are making progress towards connecting with potential candidates.</p>
        </div>
        
        <div class="footer">
            <p>This is your automated daily report from HR Outreach Emailer.</p>
            <p>Reports are sent every day at 9:00 PM while campaigns are active.</p>
        </div>
    </div>
</body>
</html>`;
  }
}

module.exports = NotificationService;
