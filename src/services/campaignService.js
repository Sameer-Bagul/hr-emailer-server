const Campaign = require('../models/Campaign');
const Email = require('../models/Email');
const Log = require('../models/Log');
const logger = require('../utils/logger');
const DateUtils = require('../utils/dateUtils');
const database = require('../config/database');
const mongodb = require('../config/mongodb');

class CampaignService {
  constructor() {
    this.cache = new Map(); // In-memory cache for recently accessed campaigns
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache timeout
  }

  // Check if MongoDB is available
  isMongoDBAvailable() {
    return mongodb && mongodb.isConnected;
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
      logger.info(`[CAMPAIGN SERVICE] Creating campaign from data: ${JSON.stringify({
        hasContacts: campaignData.contacts?.length > 0,
        hasTemplate: !!campaignData.template,
        userEmail: campaignData.userEmail
      })}`);

      const campaign = new Campaign(campaignData);
      logger.info(`[CAMPAIGN SERVICE] Campaign instance created with ID: ${campaign.id}`);

      // Validate campaign
      const validation = campaign.isValid();
      if (!validation.valid) {
        throw new Error(`Campaign validation failed: ${validation.errors.join(', ')}`);
      }

      let savedCampaign;

      if (this.isMongoDBAvailable()) {
        // Save to MongoDB
        savedCampaign = await campaign.save();
        logger.info(`[CAMPAIGN SERVICE] Saved campaign to MongoDB with ID: ${savedCampaign.id}`);

        // Log campaign creation
        await Log.logCampaignEvent(savedCampaign.id, 'created', {
          name: savedCampaign.name,
          totalEmails: savedCampaign.totalEmails,
          userEmail: savedCampaign.userEmail
        });
      } else {
        // Fall back to JSON file storage
        const campaignJson = campaign.toJSON();
        savedCampaign = database.addCampaign(campaignJson);
        logger.info(`[CAMPAIGN SERVICE] Saved campaign to JSON storage with ID: ${savedCampaign.id}`);
      }

      // Update cache
      this.updateCache(savedCampaign);

      logger.campaign(`Campaign created successfully: ${campaign.name} (${campaign.id})`);

      return savedCampaign;
    } catch (error) {
      logger.error(`Failed to create campaign: ${error.message}`);
      throw error;
    }
  }

  // Get campaign by ID with caching
  async getCampaignById(campaignId) {
    try {
      // Try cache first
      const cached = this.getCampaignFromCache(campaignId);
      if (cached) {
        return cached;
      }

      // Load from database
      const campaign = await Campaign.findOne({ id: campaignId });
      if (!campaign) {
        return null;
      }

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
      const updatedCampaign = await Campaign.findOneAndUpdate(
        { id: campaignId },
        {
          ...updates,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!updatedCampaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Update cache
      this.updateCache(updatedCampaign);

      // Log campaign update
      await Log.logCampaignEvent(campaignId, 'updated', updates);

      logger.campaign(`Campaign updated: ${campaignId}`);
      return updatedCampaign;
    } catch (error) {
      logger.error(`Failed to update campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  // Get all active campaigns (no caching for list operations)
  async getActiveCampaigns() {
    try {
      return await Campaign.getActiveCampaigns();
    } catch (error) {
      logger.error(`Failed to get active campaigns: ${error.message}`);
      return [];
    }
  }

  // Get all campaigns (no caching for list operations)
  async getAllCampaigns() {
    try {
      return await Campaign.find({}).sort({ createdAt: -1 });
    } catch (error) {
      logger.error(`Failed to get all campaigns: ${error.message}`);
      return [];
    }
  }

  // Update campaign progress
  async updateCampaignProgress(campaignId, successCount, failedCount, logData = null) {
    try {
      const campaign = await this.getCampaignById(campaignId);
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
      const updatedCampaign = await campaign.save();

      // Log progress update
      await Log.logCampaignEvent(campaignId, 'progress_updated', {
        sentEmails: updatedCampaign.sentEmails,
        failedEmails: updatedCampaign.failedEmails,
        totalEmails: updatedCampaign.totalEmails
      });

      logger.campaign(`Campaign progress updated: ${campaign.name} - ${campaign.sentEmails}/${campaign.totalEmails} emails sent`);

      return updatedCampaign;
    } catch (error) {
      logger.error(`Failed to update campaign progress: ${error.message}`);
      throw error;
    }
  }

  // Complete campaign
  async completeCampaign(campaignId) {
    try {
      const updates = {
        status: 'completed',
        completedAt: new Date()
      };

      const completedCampaign = await this.updateCampaign(campaignId, updates);

      // Log campaign completion
      await Log.logCampaignEvent(campaignId, 'completed', {
        totalEmails: completedCampaign.totalEmails,
        sentEmails: completedCampaign.sentEmails,
        failedEmails: completedCampaign.failedEmails
      });

      return completedCampaign;
    } catch (error) {
      logger.error(`Failed to complete campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  // Get next batch for campaign
  async getNextBatch(campaignId) {
    try {
      const campaign = await this.getCampaignById(campaignId);
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
  async getCampaignStats(campaignId) {
    try {
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        return null;
      }

      // Get email statistics from Email collection
      const emailStats = await Email.getEmailStats(campaignId);

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
        dailyLogs: campaign.dailyLogs,
        emailStats: emailStats
      };

      return stats;
    } catch (error) {
      logger.error(`Failed to get campaign stats: ${error.message}`);
      return null;
    }
  }

  // Get campaigns summary
  async getCampaignsSummary() {
    try {
      const campaigns = await this.getAllCampaigns();

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
  async pauseCampaign(campaignId) {
    try {
      const pausedCampaign = await this.updateCampaign(campaignId, { status: 'paused' });

      // Log campaign pause
      await Log.logCampaignEvent(campaignId, 'paused');

      return pausedCampaign;
    } catch (error) {
      logger.error(`Failed to pause campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  // Resume campaign
  async resumeCampaign(campaignId) {
    try {
      const resumedCampaign = await this.updateCampaign(campaignId, { status: 'active' });

      // Log campaign resume
      await Log.logCampaignEvent(campaignId, 'resumed');

      return resumedCampaign;
    } catch (error) {
      logger.error(`Failed to resume campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  // Delete campaign
  async deleteCampaign(campaignId) {
    try {
      // Soft delete - mark as deleted
      const deletedCampaign = await this.updateCampaign(campaignId, { status: 'deleted' });

      // Log campaign deletion
      await Log.logCampaignEvent(campaignId, 'deleted');

      return deletedCampaign;
    } catch (error) {
      logger.error(`Failed to delete campaign ${campaignId}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = CampaignService;
