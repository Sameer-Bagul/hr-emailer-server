const CampaignService = require('../services/campaignService');
const EmailService = require('../services/emailService');
const logger = require('../utils/logger');

class CampaignController {
  constructor() {
    this.campaignService = new CampaignService();
    this.emailService = new EmailService();
  }
  
  // GET /api/campaigns - Get all campaigns
  async getAllCampaigns(req, res) {
    try {
      const campaigns = await this.campaignService.getAllCampaigns();
      const campaignSummaries = campaigns.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        totalEmails: campaign.totalEmails,
        sentEmails: campaign.sentEmails,
        progress: Math.round((campaign.sentEmails / campaign.totalEmails) * 100),
        createdAt: campaign.createdAt,
        estimatedCompletion: campaign.getEstimatedCompletion()
      }));

      res.json(campaignSummaries);
    } catch (error) {
      logger.error(`Error getting campaigns: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/campaign/:id - Get campaign by ID
  async getCampaignById(req, res) {
    try {
      const { id } = req.params;
      const campaign = this.campaignService.getCampaignById(id);
      
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const campaignStats = this.campaignService.getCampaignStats(id);
      res.json(campaignStats);
    } catch (error) {
      logger.error(`Error getting campaign ${req.params.id}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/campaigns - Create new campaign
  async createCampaign(req, res) {
    try {
      const campaignData = req.body;
      
      // Validate required fields
      if (!campaignData.userEmail) {
        return res.status(400).json({ error: 'User email is required for campaigns' });
      }

      if (!campaignData.contacts || campaignData.contacts.length === 0) {
        return res.status(400).json({ error: 'At least one contact is required' });
      }

      // Create campaign
      const campaign = this.campaignService.createCampaign(campaignData);
      
      logger.campaign(`Campaign created successfully: ${campaign.id}`);
      
      res.status(201).json({
        success: true,
        message: 'Campaign created successfully',
        campaignId: campaign.id,
        totalEmails: campaign.totalEmails,
        dailyBatches: Math.ceil(campaign.totalEmails / 300),
        estimatedDays: Math.ceil(campaign.totalEmails / 300),
        type: 'campaign'
      });
    } catch (error) {
      logger.error(`Error creating campaign: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/campaign/:id - Update campaign
  async updateCampaign(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updatedCampaign = this.campaignService.updateCampaign(id, updates);
      
      res.json({
        success: true,
        message: 'Campaign updated successfully',
        campaign: updatedCampaign.getProgress()
      });
    } catch (error) {
      logger.error(`Error updating campaign ${req.params.id}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/campaign/:id/pause - Pause campaign
  async pauseCampaign(req, res) {
    try {
      const { id } = req.params;
      const campaign = this.campaignService.pauseCampaign(id);
      
      res.json({
        success: true,
        message: 'Campaign paused successfully',
        campaign: campaign.getProgress()
      });
    } catch (error) {
      logger.error(`Error pausing campaign ${req.params.id}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/campaign/:id/resume - Resume campaign
  async resumeCampaign(req, res) {
    try {
      const { id } = req.params;
      const campaign = this.campaignService.resumeCampaign(id);
      
      res.json({
        success: true,
        message: 'Campaign resumed successfully',
        campaign: campaign.getProgress()
      });
    } catch (error) {
      logger.error(`Error resuming campaign ${req.params.id}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/campaign/:id - Delete campaign
  async deleteCampaign(req, res) {
    try {
      const { id } = req.params;
      this.campaignService.deleteCampaign(id);
      
      res.json({
        success: true,
        message: 'Campaign deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting campaign ${req.params.id}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/campaigns/summary - Get campaigns summary
  async getCampaignsSummary(req, res) {
    try {
      const summary = this.campaignService.getCampaignsSummary();
      res.json(summary);
    } catch (error) {
      logger.error(`Error getting campaigns summary: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/campaign/:id/stats - Get detailed campaign statistics
  async getCampaignStats(req, res) {
    try {
      const { id } = req.params;
      const stats = this.campaignService.getCampaignStats(id);
      
      if (!stats) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      res.json(stats);
    } catch (error) {
      logger.error(`Error getting campaign stats ${req.params.id}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/campaigns/trigger - Manually trigger campaign processing (for testing)
  async triggerCampaignProcessing(req, res) {
    try {
      const schedulerService = req.app.get('schedulerService');
      if (!schedulerService) {
        return res.status(500).json({ error: 'Scheduler service not available' });
      }

      const { force = false } = req.body; // Allow forcing processing outside business hours

      logger.info('Manually triggering campaign processing...');
      await schedulerService.triggerDailyCampaigns(force);
      
      res.json({
        success: true,
        message: `Campaign processing triggered successfully${force ? ' (forced)' : ''}`
      });
    } catch (error) {
      logger.error(`Error triggering campaign processing: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/campaigns/:id/continue - Continue processing a specific campaign
  async continueCampaignProcessing(req, res) {
    try {
      const { id } = req.params;
      const { maxBatches = 10 } = req.body;
      
      const schedulerService = req.app.get('schedulerService');
      if (!schedulerService) {
        return res.status(500).json({ error: 'Scheduler service not available' });
      }

      logger.info(`Manually continuing campaign processing for ${id}...`);
      const result = await schedulerService.continueCampaignProcessing(id, maxBatches);
      
      res.json({
        success: true,
        message: `Campaign processing continued successfully`,
        result: result
      });
    } catch (error) {
      logger.error(`Error continuing campaign processing: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/campaigns/trigger-summary - Manually trigger daily summary (for testing)
  async triggerDailySummary(req, res) {
    try {
      const schedulerService = req.app.get('schedulerService');
      if (!schedulerService) {
        return res.status(500).json({ error: 'Scheduler service not available' });
      }

      logger.info('Manually triggering daily summary...');
      await schedulerService.triggerDailySummary();
      
      res.json({
        success: true,
        message: 'Daily summary triggered successfully'
      });
    } catch (error) {
      logger.error(`Error triggering daily summary: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/campaigns/trigger-evening-report - Manually trigger evening report (for testing)
  async triggerEveningReport(req, res) {
    try {
      const schedulerService = req.app.get('schedulerService');
      if (!schedulerService) {
        return res.status(500).json({ error: 'Scheduler service not available' });
      }

      logger.info('Manually triggering evening report...');
      await schedulerService.triggerEveningReport();
      
      res.json({
        success: true,
        message: 'Evening report triggered successfully'
      });
    } catch (error) {
      logger.error(`Error triggering evening report: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = CampaignController;
