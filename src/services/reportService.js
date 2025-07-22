const CampaignService = require('./campaignService');
const logger = require('../utils/logger');
const { formatDate, calculateDuration } = require('../utils/dateUtils');

class ReportService {
  constructor() {
    this.campaignService = new CampaignService();
    logger.info('Report service initialized');
  }

  // Generate comprehensive campaign report
  async generateCampaignReport(campaignId) {
    try {
      const campaign = await this.campaignService.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const progress = this.campaignService.calculateProgress(campaign);
      const analytics = this.calculateEmailAnalytics(campaign.emailLogs);
      const timeline = this.generateTimeline(campaign);

      const report = {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          createdAt: campaign.createdAt,
          startedAt: campaign.startedAt,
          completedAt: campaign.completedAt,
          duration: campaign.duration || this.calculateCampaignDuration(campaign)
        },
        progress: {
          total: progress.total,
          sent: progress.sent,
          failed: progress.failed,
          pending: progress.pending,
          completionRate: progress.total > 0 ? (progress.sent / progress.total * 100).toFixed(2) : 0,
          successRate: progress.sent > 0 ? ((progress.sent / (progress.sent + progress.failed)) * 100).toFixed(2) : 0
        },
        analytics,
        timeline,
        contacts: {
          total: campaign.contacts ? campaign.contacts.length : 0,
          contacted: campaign.emailLogs ? campaign.emailLogs.filter(log => log.status === 'sent').length : 0,
          remaining: progress.pending
        },
        settings: {
          dailyLimit: campaign.dailyLimit || 50,
          senderName: campaign.senderName,
          senderEmail: campaign.senderEmail,
          subject: campaign.subject
        }
      };

      logger.info(`Generated report for campaign ${campaignId}`);
      return report;
    } catch (error) {
      logger.error(`Error generating campaign report: ${error.message}`);
      throw error;
    }
  }

  // Generate summary report for all campaigns
  async generateSummaryReport(dateRange = null) {
    try {
      const campaigns = await this.campaignService.getAllCampaigns();
      let filteredCampaigns = campaigns;

      // Apply date filter if provided
      if (dateRange && dateRange.startDate && dateRange.endDate) {
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        
        filteredCampaigns = campaigns.filter(campaign => {
          const campaignDate = new Date(campaign.createdAt);
          return campaignDate >= startDate && campaignDate <= endDate;
        });
      }

      const summary = {
        overview: {
          totalCampaigns: filteredCampaigns.length,
          activeCampaigns: filteredCampaigns.filter(c => c.status === 'active').length,
          completedCampaigns: filteredCampaigns.filter(c => c.status === 'completed').length,
          pendingCampaigns: filteredCampaigns.filter(c => c.status === 'pending').length,
          pausedCampaigns: filteredCampaigns.filter(c => c.status === 'paused').length
        },
        emailStats: this.calculateOverallEmailStats(filteredCampaigns),
        performanceMetrics: this.calculatePerformanceMetrics(filteredCampaigns),
        recentActivity: this.getRecentActivity(filteredCampaigns),
        topPerformers: this.getTopPerformingCampaigns(filteredCampaigns)
      };

      logger.info(`Generated summary report for ${filteredCampaigns.length} campaigns`);
      return summary;
    } catch (error) {
      logger.error(`Error generating summary report: ${error.message}`);
      throw error;
    }
  }

  // Calculate email analytics for a campaign
  calculateEmailAnalytics(emailLogs) {
    if (!emailLogs || emailLogs.length === 0) {
      return {
        totalSent: 0,
        successRate: 0,
        failureRate: 0,
        dailyStats: [],
        errorBreakdown: {}
      };
    }

    const sent = emailLogs.filter(log => log.status === 'sent').length;
    const failed = emailLogs.filter(log => log.status === 'failed').length;
    const total = emailLogs.length;

    // Daily statistics
    const dailyStats = this.groupEmailsByDate(emailLogs);

    // Error breakdown
    const errorBreakdown = {};
    emailLogs.filter(log => log.status === 'failed').forEach(log => {
      const errorType = this.categorizeError(log.error);
      errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
    });

    return {
      totalSent: sent,
      totalFailed: failed,
      successRate: total > 0 ? (sent / total * 100).toFixed(2) : 0,
      failureRate: total > 0 ? (failed / total * 100).toFixed(2) : 0,
      dailyStats,
      errorBreakdown
    };
  }

  // Calculate overall email statistics
  calculateOverallEmailStats(campaigns) {
    let totalSent = 0;
    let totalFailed = 0;
    let totalContacts = 0;

    campaigns.forEach(campaign => {
      if (campaign.emailLogs) {
        totalSent += campaign.emailLogs.filter(log => log.status === 'sent').length;
        totalFailed += campaign.emailLogs.filter(log => log.status === 'failed').length;
      }
      if (campaign.contacts) {
        totalContacts += campaign.contacts.length;
      }
    });

    const total = totalSent + totalFailed;

    return {
      totalSent,
      totalFailed,
      totalContacts,
      successRate: total > 0 ? (totalSent / total * 100).toFixed(2) : 0,
      failureRate: total > 0 ? (totalFailed / total * 100).toFixed(2) : 0,
      contactedRate: totalContacts > 0 ? (totalSent / totalContacts * 100).toFixed(2) : 0
    };
  }

  // Calculate performance metrics
  calculatePerformanceMetrics(campaigns) {
    const completedCampaigns = campaigns.filter(c => c.status === 'completed' && c.duration);
    
    let avgDuration = 0;
    let avgDailyEmails = 0;
    let avgSuccessRate = 0;

    if (completedCampaigns.length > 0) {
      // Average duration
      const totalDuration = completedCampaigns.reduce((sum, c) => sum + (c.duration || 0), 0);
      avgDuration = (totalDuration / completedCampaigns.length).toFixed(1);

      // Average daily emails
      let totalDailyEmails = 0;
      completedCampaigns.forEach(campaign => {
        if (campaign.emailLogs && campaign.duration > 0) {
          const sentEmails = campaign.emailLogs.filter(log => log.status === 'sent').length;
          totalDailyEmails += sentEmails / campaign.duration;
        }
      });
      avgDailyEmails = (totalDailyEmails / completedCampaigns.length).toFixed(1);

      // Average success rate
      let totalSuccessRate = 0;
      completedCampaigns.forEach(campaign => {
        if (campaign.emailLogs) {
          const sent = campaign.emailLogs.filter(log => log.status === 'sent').length;
          const total = campaign.emailLogs.length;
          if (total > 0) {
            totalSuccessRate += (sent / total * 100);
          }
        }
      });
      avgSuccessRate = (totalSuccessRate / completedCampaigns.length).toFixed(2);
    }

    return {
      averageDuration: avgDuration,
      averageDailyEmails: avgDailyEmails,
      averageSuccessRate: avgSuccessRate,
      completedCampaigns: completedCampaigns.length
    };
  }

  // Get recent activity
  getRecentActivity(campaigns, days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentActivity = [];

    campaigns.forEach(campaign => {
      // Recent campaign creation
      if (new Date(campaign.createdAt) > cutoffDate) {
        recentActivity.push({
          type: 'campaign_created',
          campaignId: campaign.id,
          campaignName: campaign.name,
          timestamp: campaign.createdAt
        });
      }

      // Recent campaign completion
      if (campaign.completedAt && new Date(campaign.completedAt) > cutoffDate) {
        recentActivity.push({
          type: 'campaign_completed',
          campaignId: campaign.id,
          campaignName: campaign.name,
          timestamp: campaign.completedAt
        });
      }

      // Recent emails
      if (campaign.emailLogs) {
        campaign.emailLogs.forEach(log => {
          if (new Date(log.sentAt) > cutoffDate) {
            recentActivity.push({
              type: log.status === 'sent' ? 'email_sent' : 'email_failed',
              campaignId: campaign.id,
              campaignName: campaign.name,
              recipient: log.to,
              timestamp: log.sentAt
            });
          }
        });
      }
    });

    // Sort by timestamp (most recent first) and limit to 50 items
    return recentActivity
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);
  }

  // Get top performing campaigns
  getTopPerformingCampaigns(campaigns, limit = 5) {
    const campaignsWithMetrics = campaigns
      .filter(campaign => campaign.emailLogs && campaign.emailLogs.length > 0)
      .map(campaign => {
        const sent = campaign.emailLogs.filter(log => log.status === 'sent').length;
        const total = campaign.emailLogs.length;
        const successRate = total > 0 ? (sent / total * 100) : 0;

        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          totalEmails: total,
          successfulEmails: sent,
          successRate: successRate.toFixed(2),
          duration: campaign.duration || this.calculateCampaignDuration(campaign)
        };
      });

    // Sort by success rate, then by total emails sent
    return campaignsWithMetrics
      .sort((a, b) => {
        if (parseFloat(b.successRate) === parseFloat(a.successRate)) {
          return b.successfulEmails - a.successfulEmails;
        }
        return parseFloat(b.successRate) - parseFloat(a.successRate);
      })
      .slice(0, limit);
  }

  // Helper methods
  groupEmailsByDate(emailLogs) {
    const dailyStats = {};

    emailLogs.forEach(log => {
      const date = formatDate(log.sentAt);
      if (!dailyStats[date]) {
        dailyStats[date] = { sent: 0, failed: 0 };
      }
      
      if (log.status === 'sent') {
        dailyStats[date].sent++;
      } else if (log.status === 'failed') {
        dailyStats[date].failed++;
      }
    });

    return Object.entries(dailyStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  categorizeError(errorMessage) {
    if (!errorMessage) return 'Unknown';
    
    const message = errorMessage.toLowerCase();
    
    if (message.includes('authentication') || message.includes('auth')) {
      return 'Authentication';
    } else if (message.includes('invalid') && message.includes('email')) {
      return 'Invalid Email';
    } else if (message.includes('timeout') || message.includes('connection')) {
      return 'Connection';
    } else if (message.includes('rate limit') || message.includes('quota')) {
      return 'Rate Limit';
    } else if (message.includes('bounce') || message.includes('rejected')) {
      return 'Delivery';
    } else {
      return 'Other';
    }
  }

  calculateCampaignDuration(campaign) {
    if (campaign.duration) return campaign.duration;
    
    if (campaign.startedAt && campaign.completedAt) {
      return calculateDuration(campaign.startedAt, campaign.completedAt);
    } else if (campaign.startedAt) {
      return calculateDuration(campaign.startedAt, new Date());
    }
    
    return 0;
  }

  generateTimeline(campaign) {
    const timeline = [];

    timeline.push({
      event: 'Campaign Created',
      timestamp: campaign.createdAt,
      description: `Campaign "${campaign.name}" was created`
    });

    if (campaign.startedAt) {
      timeline.push({
        event: 'Campaign Started',
        timestamp: campaign.startedAt,
        description: 'Email sending began'
      });
    }

    if (campaign.completedAt) {
      timeline.push({
        event: 'Campaign Completed',
        timestamp: campaign.completedAt,
        description: `Campaign finished after ${campaign.duration || 0} days`
      });
    }

    return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }
}

module.exports = ReportService;
