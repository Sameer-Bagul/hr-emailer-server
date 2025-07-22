const Campaign = require('../models/Campaign');
const database = require('../config/database');
const logger = require('../utils/logger');
const DateUtils = require('../utils/dateUtils');

class CampaignService {
  // Create a new campaign
  createCampaign(campaignData) {
    try {
      const campaign = new Campaign(campaignData);
      
      // Validate campaign
      const validation = campaign.isValid();
      if (!validation.valid) {
        throw new Error(`Campaign validation failed: ${validation.errors.join(', ')}`);
      }

      // Save to database
      const savedCampaign = database.addCampaign(campaign.toJSON());
      logger.campaign(`Campaign created successfully: ${campaign.name} (${campaign.id})`);
      
      return savedCampaign;
    } catch (error) {
      logger.error(`Failed to create campaign: ${error.message}`);
      throw error;
    }
  }

  // Get campaign by ID
  getCampaignById(campaignId) {
    try {
      const campaignData = database.findCampaignById(campaignId);
      if (!campaignData) {
        return null;
      }

      return new Campaign(campaignData);
    } catch (error) {
      logger.error(`Failed to get campaign ${campaignId}: ${error.message}`);
      return null;
    }
  }

  // Get all active campaigns
  getActiveCampaigns() {
    try {
      const activeCampaignsData = database.getActiveCampaigns();
      return activeCampaignsData.map(data => new Campaign(data));
    } catch (error) {
      logger.error(`Failed to get active campaigns: ${error.message}`);
      return [];
    }
  }

  // Get all campaigns
  getAllCampaigns() {
    try {
      const campaignsData = database.getAllCampaigns();
      return campaignsData.map(data => new Campaign(data));
    } catch (error) {
      logger.error(`Failed to get all campaigns: ${error.message}`);
      return [];
    }
  }

  // Update campaign
  updateCampaign(campaignId, updates) {
    try {
      const updatedData = database.updateCampaign(campaignId, {
        ...updates,
        updatedAt: DateUtils.getCurrentTimestamp()
      });

      if (!updatedData) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      logger.campaign(`Campaign updated: ${campaignId}`);
      return new Campaign(updatedData);
    } catch (error) {
      logger.error(`Failed to update campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  // Update campaign progress
  updateCampaignProgress(campaignId, successCount, failedCount, logData = null) {
    try {
      const campaign = this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Update progress
      campaign.updateProgress(successCount, failedCount);

      // Add daily log if provided
      if (logData) {
        campaign.addDailyLog(logData);
      }

      // Save to database
      const updatedCampaign = database.updateCampaign(campaignId, campaign.toJSON());
      logger.campaign(`Campaign progress updated: ${campaign.name} - ${campaign.sentEmails}/${campaign.totalEmails} emails sent`);

      return new Campaign(updatedCampaign);
    } catch (error) {
      logger.error(`Failed to update campaign progress: ${error.message}`);
      throw error;
    }
  }

  // Complete campaign
  completeCampaign(campaignId) {
    try {
      const updates = {
        status: 'completed',
        completedAt: DateUtils.getCurrentTimestamp()
      };

      return this.updateCampaign(campaignId, updates);
    } catch (error) {
      logger.error(`Failed to complete campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  // Get next batch for campaign
  getNextBatch(campaignId) {
    try {
      const campaign = this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      return campaign.getNextBatch();
    } catch (error) {
      logger.error(`Failed to get next batch for campaign ${campaignId}: ${error.message}`);
      return null;
    }
  }

  // Get campaign statistics
  getCampaignStats(campaignId) {
    try {
      const campaign = this.getCampaignById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      const stats = {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        totalEmails: campaign.totalEmails,
        sentEmails: campaign.sentEmails,
        failedEmails: campaign.failedEmails,
        successRate: campaign.totalEmails > 0 ? Math.round((campaign.sentEmails / campaign.totalEmails) * 100) : 0,
        progress: campaign.getProgress(),
        duration: campaign.completedAt ? DateUtils.calculateDuration(campaign.createdAt, campaign.completedAt) : null,
        estimatedCompletion: campaign.getEstimatedCompletion(),
        dailyLogs: campaign.dailyLogs
      };

      return stats;
    } catch (error) {
      logger.error(`Failed to get campaign stats: ${error.message}`);
      return null;
    }
  }

  // Get campaigns summary
  getCampaignsSummary() {
    try {
      const campaigns = this.getAllCampaigns();
      
      const summary = {
        total: campaigns.length,
        active: campaigns.filter(c => c.status === 'active').length,
        completed: campaigns.filter(c => c.status === 'completed').length,
        paused: campaigns.filter(c => c.status === 'paused').length,
        totalEmailsSent: campaigns.reduce((sum, c) => sum + c.sentEmails, 0),
        totalEmailsFailed: campaigns.reduce((sum, c) => sum + c.failedEmails, 0),
        campaigns: campaigns.map(c => c.getProgress())
      };

      return summary;
    } catch (error) {
      logger.error(`Failed to get campaigns summary: ${error.message}`);
      return null;
    }
  }

  // Pause campaign
  pauseCampaign(campaignId) {
    try {
      return this.updateCampaign(campaignId, { status: 'paused' });
    } catch (error) {
      logger.error(`Failed to pause campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  // Resume campaign
  resumeCampaign(campaignId) {
    try {
      return this.updateCampaign(campaignId, { status: 'active' });
    } catch (error) {
      logger.error(`Failed to resume campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  // Delete campaign
  deleteCampaign(campaignId) {
    try {
      // In a real implementation, you'd want to implement database.deleteCampaign()
      // For now, we'll mark it as deleted
      return this.updateCampaign(campaignId, { status: 'deleted' });
    } catch (error) {
      logger.error(`Failed to delete campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = CampaignService;
