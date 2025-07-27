const Campaign = require('../models/Campaign');
const database = require('../config/database');
const logger = require('../utils/logger');
const DateUtils = require('../utils/dateUtils');

class CampaignService {
  constructor() {
    this.cache = new Map(); // In-memory cache for recently accessed campaigns
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache timeout
  }

  // Get campaign from cache or database
  getCampaignFromCache(campaignId) {
    const cached = this.cache.get(campaignId);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.campaign;
    }
    return null;
  }

  // Update cache
  updateCache(campaign) {
    this.cache.set(campaign.id, {
      campaign: campaign,
      timestamp: Date.now()
    });

    // Cleanup old cache entries
    if (this.cache.size > 50) { // Limit cache size
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  // Create a new campaign
  async createCampaign(campaignData) {
    try {
      const campaign = new Campaign(campaignData);
      
      // Validate campaign
      const validation = campaign.isValid();
      if (!validation.valid) {
        throw new Error(`Campaign validation failed: ${validation.errors.join(', ')}`);
      }

      // Save to database
      const savedCampaign = await database.addCampaign(campaign.toJSON());
      
      // Update cache
      const campaignInstance = new Campaign(savedCampaign);
      this.updateCache(campaignInstance);
      
      logger.campaign(`Campaign created successfully: ${campaign.name} (${campaign.id})`);
      
      return savedCampaign;
    } catch (error) {
      logger.error(`Failed to create campaign: ${error.message}`);
      throw error;
    }
  }

  // Get campaign by ID with caching
  getCampaignById(campaignId) {
    try {
      // Try cache first
      const cached = this.getCampaignFromCache(campaignId);
      if (cached) {
        return cached;
      }

      // Load from database
      const campaignData = database.findCampaignById(campaignId);
      if (!campaignData) {
        return null;
      }

      const campaign = new Campaign(campaignData);
      this.updateCache(campaign);
      return campaign;
    } catch (error) {
      logger.error(`Failed to get campaign ${campaignId}: ${error.message}`);
      return null;
    }
  }

  // Update campaign with cache invalidation
  async updateCampaign(campaignId, updates) {
    try {
      const updatedData = await database.updateCampaign(campaignId, {
        ...updates,
        updatedAt: DateUtils.getCurrentTimestamp()
      });

      if (!updatedData) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Update cache
      const campaign = new Campaign(updatedData);
      this.updateCache(campaign);

      logger.campaign(`Campaign updated: ${campaignId}`);
      return campaign;
    } catch (error) {
      logger.error(`Failed to update campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  // Get all active campaigns (no caching for list operations)
  getActiveCampaigns() {
    try {
      const activeCampaignsData = database.getActiveCampaigns();
      return activeCampaignsData.map(data => new Campaign(data));
    } catch (error) {
      logger.error(`Failed to get active campaigns: ${error.message}`);
      return [];
    }
  }

  // Get all campaigns (no caching for list operations)  
  getAllCampaigns() {
    try {
      const campaignsData = database.getAllCampaigns();
      return campaignsData.map(data => new Campaign(data));
    } catch (error) {
      logger.error(`Failed to get all campaigns: ${error.message}`);
      return [];
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
